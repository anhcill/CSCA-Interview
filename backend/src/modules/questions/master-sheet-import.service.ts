import { DegreeLevel, DifficultyLevel, LanguageCode, Prisma, QuestionCategory, type Major, type Question, type School } from "@prisma/client";
import type { Request } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { writeAdminAuditLog } from "../admin/audit.service.js";
import type { AuthenticatedUser } from "../auth/auth.middleware.js";
import {
  normalizeLookupText,
  normalizeQuestionLookupKey,
  normalizeSchoolLookupKey,
  parseInterviewSheetCsv,
  type ParsedInterviewSheetQuestion
} from "./interview-sheet-parser.js";
import {
  parseNormalizedMasterSheetCsv,
  type NormalizedMasterSheetIssue,
  type NormalizedMasterSheetSkippedRow
} from "./normalized-master-sheet-parser.js";

export const defaultQuestionMasterSheetUrl = "https://docs.google.com/spreadsheets/d/10xNUES4YGjjrvfFQFMer7zZcQElB2s8gmA557FRE_BE/edit?pli=1&gid=2018224967#gid=2018224967";

const syncSettingKey = "question_master_sheet_sync";

type MasterSheetSourceInput = {
  csv?: string;
  sourceUrl?: string | null;
};

export type MasterSheetImportInput = MasterSheetSourceInput & {
  createMissingMajors?: boolean;
  createMissingSchools?: boolean;
  updateExisting?: boolean;
};

type SchoolLookup = Pick<School, "id" | "name" | "nameEn" | "nameZh">;
type MajorLookup = Pick<Major, "degreeLevel" | "id" | "name">;
type QuestionLookup = Pick<Question, "degreeLevel" | "id" | "language" | "majorId" | "questionText" | "schoolId">;

type MasterSheetIssue = NormalizedMasterSheetIssue;
type MasterSheetSkippedRow = NormalizedMasterSheetSkippedRow;

type PreparedMasterSheet = {
  csvHash: string;
  csvUrl: string | null;
  duplicateQuestionsInSheet: number;
  errors: MasterSheetIssue[];
  indexes: Awaited<ReturnType<typeof loadImportIndexes>>;
  parseStats: {
    generatedRecords: number;
    readyRows: number | null;
    skippedRows: number;
    sourceRows: number | null;
  };
  questions: ParsedInterviewSheetQuestion[];
  skippedRows: MasterSheetSkippedRow[];
  sourceUrl: string | null;
  sourceFormat: "legacy" | "normalized";
  warnings: MasterSheetIssue[];
};

export class MasterSheetImportError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "MasterSheetImportError";
    this.details = details;
    this.status = status;
  }
}

export async function previewQuestionMasterSheet(input: MasterSheetSourceInput) {
  const prepared = await prepareMasterSheet(input);
  return buildPreview(prepared);
}

export async function importQuestionMasterSheet(req: Request, user: AuthenticatedUser, input: MasterSheetImportInput) {
  const prepared = await prepareMasterSheet(input);
  const blockingErrors = prepared.errors.filter((issue) => issue.severity === "error");
  if (blockingErrors.length) {
    throw new MasterSheetImportError(
      `Sheet còn ${blockingErrors.length} lỗi dữ liệu. Vui lòng sửa lỗi trong phần kiểm tra sheet trước khi import.`,
      400,
      { preview: buildPreview(prepared) }
    );
  }

  const createMissingSchools = input.createMissingSchools ?? true;
  const createMissingMajors = input.createMissingMajors ?? true;
  const updateExisting = input.updateExisting ?? true;
  const skipped: Array<{ questionCode?: string | null; reason: string; sourceColumn?: number; sourceColumnName?: string | null; sourceRow: number }> = prepared.skippedRows.map((row) => ({
    questionCode: row.questionCode,
    reason: row.reason,
    sourceRow: row.sourceRow
  }));
  const stats = {
    createdQuestions: 0,
    createdMajors: 0,
    createdSchools: 0,
    duplicateQuestionsInSheet: prepared.duplicateQuestionsInSheet,
    linkedSchoolMajors: 0,
    skippedQuestions: prepared.skippedRows.length,
    unchangedQuestions: 0,
    updatedQuestions: 0
  };

  for (const question of prepared.questions) {
    const school = await ensureSchool(question.schoolName, prepared.indexes, createMissingSchools);
    if (!school) {
      skipped.push({
        reason: "Trường chưa có trong hệ thống và tùy chọn tạo trường đang tắt.",
        sourceColumn: question.sourceColumn,
        sourceColumnName: question.sourceColumnName,
        sourceRow: question.sourceRow
      });
      stats.skippedQuestions += 1;
      continue;
    }
    if (school.created) stats.createdSchools += 1;

    const major = await ensureMajor(question.majorName, question.degreeLevel, prepared.indexes, createMissingMajors);
    if (major?.created) stats.createdMajors += 1;
    if (major?.item) {
      const linked = await ensureSchoolMajorLink(school.item.id, major.item.id, prepared.indexes);
      if (linked) stats.linkedSchoolMajors += 1;
    }

    const questionKey = createQuestionKey({
      degreeLevel: question.degreeLevel,
      language: question.language,
      majorId: major?.item?.id ?? null,
      questionText: question.questionText,
      schoolId: school.item.id
    });
    const existing = prepared.indexes.questionsByKey.get(questionKey);
    const data = buildQuestionData(question, school.item.id, major?.item?.id ?? null);

    if (existing) {
      if (updateExisting) {
        const updated = await prisma.question.update({
          data: {
            category: data.category,
            degreeLevel: data.degreeLevel,
            difficulty: data.difficulty,
            isActive: true,
            keywords: data.keywords,
            language: data.language,
            majorId: data.majorId,
            commonMistakes: data.commonMistakes,
            sampleAnswer: data.sampleAnswer,
            scoringRubric: data.scoringRubric,
            schoolId: data.schoolId,
            suggestedAnswerLogic: data.suggestedAnswerLogic,
            updatedBy: user.id
          },
          where: { id: existing.id }
        });
        prepared.indexes.questionsByKey.set(questionKey, updated);
        stats.updatedQuestions += 1;
      } else {
        stats.unchangedQuestions += 1;
      }
      continue;
    }

    const created = await prisma.question.create({
      data: {
        ...data,
        createdBy: user.id,
        isActive: true
      }
    });
    prepared.indexes.questionsByKey.set(questionKey, created);
    stats.createdQuestions += 1;
  }

  await prisma.system_settings.upsert({
    create: {
      description: "Thông tin đồng bộ Google Sheet câu hỏi phỏng vấn chính.",
      setting_key: syncSettingKey,
      setting_value: toJson({
        csvHash: prepared.csvHash,
        csvUrl: prepared.csvUrl,
        sourceUrl: prepared.sourceUrl,
        stats,
        syncedAt: new Date().toISOString()
      }),
      updated_by: user.id
    },
    update: {
      description: "Thông tin đồng bộ Google Sheet câu hỏi phỏng vấn chính.",
      setting_value: toJson({
        csvHash: prepared.csvHash,
        csvUrl: prepared.csvUrl,
        sourceUrl: prepared.sourceUrl,
        stats,
        syncedAt: new Date().toISOString()
      }),
      updated_at: new Date(),
      updated_by: user.id
    },
    where: { setting_key: syncSettingKey }
  });

  await writeAdminAuditLog(req, {
    action: "QUESTION_MASTER_SHEET_IMPORT",
    adminUserId: user.id,
    afterData: { sourceUrl: prepared.sourceUrl, stats, skipped },
    entityType: "question"
  });

  return {
    ...stats,
    preview: buildPreview(prepared),
    skipped
  };
}

async function prepareMasterSheet(input: MasterSheetSourceInput): Promise<PreparedMasterSheet> {
  const source = await resolveMasterSheetCsv(input);
  const normalized = parseNormalizedMasterSheetCsv(source.csv);
  const parsed = normalized ? null : parseInterviewSheetCsv(source.csv);
  const rawQuestions = normalized ? normalized.questions : parsed!.questions;
  const { duplicateIssues, duplicateQuestionsInSheet, questions } = dedupeSheetQuestions(rawQuestions);
  const indexes = await loadImportIndexes();
  const sourceFormat = normalized ? "normalized" : "legacy";
  const warnings = [
    ...(normalized
      ? normalized.issues.filter((issue) => issue.severity === "warning")
      : parsed!.warnings.map((warning) => ({
          code: "LEGACY_PARSE_WARNING",
          message: warning.message,
          preview: warning.preview,
          severity: "warning" as const,
          sourceColumn: warning.sourceColumn,
          sourceColumnName: null,
          sourceRow: warning.sourceRow ?? 0
        }))),
    ...duplicateIssues
  ];
  const errors = normalized ? normalized.issues.filter((issue) => issue.severity === "error") : [];

  return {
    csvHash: createHash("sha256").update(source.csv).digest("hex"),
    csvUrl: source.csvUrl,
    duplicateQuestionsInSheet,
    errors,
    indexes,
    parseStats: normalized
      ? normalized.stats
      : {
          generatedRecords: questions.length,
          readyRows: null,
          skippedRows: 0,
          sourceRows: null
        },
    questions,
    skippedRows: normalized?.skippedRows ?? [],
    sourceUrl: source.sourceUrl,
    sourceFormat,
    warnings
  };
}

async function resolveMasterSheetCsv(input: MasterSheetSourceInput) {
  const directCsv = input.csv?.trim();
  if (directCsv) {
    return {
      csv: directCsv,
      csvUrl: null,
      sourceUrl: input.sourceUrl?.trim() || null
    };
  }

  const sourceUrl = input.sourceUrl?.trim() || defaultQuestionMasterSheetUrl;
  const csvUrl = toGoogleSheetCsvUrl(sourceUrl);
  const response = await fetch(csvUrl, {
    headers: { "User-Agent": "CSCA-Interview-Master-Sheet-Importer/1.0" }
  });

  if (!response.ok) {
    throw new MasterSheetImportError(`Không thể tải Google Sheet chính (${response.status}).`, 502);
  }

  const csv = await response.text();
  if (!csv.trim()) {
    throw new MasterSheetImportError("Google Sheet chính đang trả về dữ liệu trống.", 400);
  }

  return { csv, csvUrl, sourceUrl };
}

function toGoogleSheetCsvUrl(sourceUrl: string) {
  if (/format=csv/i.test(sourceUrl) || /\.csv(?:$|[?#])/i.test(sourceUrl)) return sourceUrl;

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new MasterSheetImportError("Link Google Sheet không hợp lệ.", 400);
  }

  const sheetId = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
  if (!sheetId) {
    throw new MasterSheetImportError("Link phải là Google Sheet có dạng /spreadsheets/d/{id}.", 400);
  }

  const gid = url.searchParams.get("gid") ?? url.hash.match(/gid=(\d+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

async function loadImportIndexes() {
  const [schools, majors, questions, schoolMajorLinks] = await Promise.all([
    prisma.school.findMany({ select: { id: true, name: true, nameEn: true, nameZh: true } }),
    prisma.major.findMany({ select: { degreeLevel: true, id: true, name: true } }),
    prisma.question.findMany({
      select: {
        degreeLevel: true,
        id: true,
        language: true,
        majorId: true,
        questionText: true,
        schoolId: true
      },
      where: { deletedAt: null }
    }),
    prisma.school_majors.findMany({
      select: { major_id: true, school_id: true },
      where: { admission_season_id: null }
    })
  ]);

  return {
    majorsByKey: buildMajorIndex(majors),
    questionsByKey: buildQuestionIndex(questions),
    schoolMajorLinks: new Set(schoolMajorLinks.map((link) => createSchoolMajorKey(link.school_id, link.major_id))),
    schoolsByKey: buildSchoolIndex(schools)
  };
}

function buildPreview(prepared: PreparedMasterSheet) {
  const schoolSummaries = new Map<string, {
    existingQuestions: number;
    matchedSchoolId: string | null;
    matchedSchoolName: string | null;
    missingMajors: Set<string>;
    newQuestions: number;
    questionCount: number;
    schoolName: string;
  }>();
  const majorKeys = new Set<string>();
  let existingQuestions = 0;
  let matchedMajors = 0;
  let newQuestions = 0;

  prepared.questions.forEach((question) => {
    const school = findSchool(question.schoolName, prepared.indexes);
    const major = findMajor(question.majorName, question.degreeLevel, prepared.indexes);
    const majorKey = question.majorName ? `${question.degreeLevel}:${normalizeLookupText(question.majorName)}` : null;
    if (majorKey && !majorKeys.has(majorKey)) {
      majorKeys.add(majorKey);
      if (major) matchedMajors += 1;
    }
    const questionExists = Boolean(school && prepared.indexes.questionsByKey.get(createQuestionKey({
      degreeLevel: question.degreeLevel,
      language: question.language,
      majorId: major?.id ?? null,
      questionText: question.questionText,
      schoolId: school.id
    })));

    if (questionExists) existingQuestions += 1;
    else newQuestions += 1;

    const summary = schoolSummaries.get(question.schoolName) ?? {
      existingQuestions: 0,
      matchedSchoolId: school?.id ?? null,
      matchedSchoolName: school?.name ?? null,
      missingMajors: new Set<string>(),
      newQuestions: 0,
      questionCount: 0,
      schoolName: question.schoolName
    };
    summary.questionCount += 1;
    if (questionExists) summary.existingQuestions += 1;
    else summary.newQuestions += 1;
    if (question.majorName && !major) summary.missingMajors.add(question.majorName);
    schoolSummaries.set(question.schoolName, summary);
  });

  const schools = Array.from(schoolSummaries.values()).map((summary) => ({
    existingQuestions: summary.existingQuestions,
    matchedSchoolId: summary.matchedSchoolId,
    matchedSchoolName: summary.matchedSchoolName,
    missingMajors: Array.from(summary.missingMajors),
    newQuestions: summary.newQuestions,
    questionCount: summary.questionCount,
    schoolName: summary.schoolName,
    status: summary.matchedSchoolId ? "existing" as const : "missing" as const
  }));
  const matchedSchools = schools.filter((school) => school.status === "existing").length;
  const missingSchools = schools.length - matchedSchools;

  return {
    recordsPreview: prepared.questions.slice(0, 20),
    schools,
    source: {
      csvHash: prepared.csvHash,
      csvUrl: prepared.csvUrl,
      sourceFormat: prepared.sourceFormat,
      sourceUrl: prepared.sourceUrl
    },
    stats: {
      duplicateQuestionsInSheet: prepared.duplicateQuestionsInSheet,
      errors: prepared.errors.length,
      existingQuestions,
      generatedRecords: prepared.parseStats.generatedRecords,
      matchedMajors,
      matchedSchools,
      missingMajors: Math.max(0, majorKeys.size - matchedMajors),
      missingSchools,
      newQuestions,
      questions: prepared.questions.length,
      readyRows: prepared.parseStats.readyRows,
      schools: schools.length,
      skippedRows: prepared.skippedRows.length,
      sourceRows: prepared.parseStats.sourceRows,
      totalMajors: majorKeys.size,
      warnings: prepared.warnings.length
    },
    errors: prepared.errors,
    skippedRows: prepared.skippedRows,
    warnings: prepared.warnings
  };
}

function dedupeSheetQuestions(questions: ParsedInterviewSheetQuestion[]) {
  const byKey = new Map<string, ParsedInterviewSheetQuestion>();
  const duplicateIssues: MasterSheetIssue[] = [];

  questions.forEach((question) => {
    const key = createSheetQuestionKey(question);
    const existing = byKey.get(key);
    if (existing) {
      duplicateIssues.push({
        code: "DUPLICATE_QUESTION_IN_SHEET",
        message: `Câu hỏi trùng với dòng ${existing.sourceRow}; hệ thống sẽ bỏ qua bản trùng này khi import.`,
        preview: question.questionText.slice(0, 180),
        questionCode: question.questionCode,
        severity: "warning",
        sourceColumn: question.sourceColumn,
        sourceColumnName: question.sourceColumnName,
        sourceRow: question.sourceRow
      });
      return;
    }
    byKey.set(key, question);
  });

  return {
    duplicateIssues,
    duplicateQuestionsInSheet: Math.max(0, questions.length - byKey.size),
    questions: Array.from(byKey.values())
  };
}

function createSheetQuestionKey(question: ParsedInterviewSheetQuestion) {
  return [
    normalizeSchoolLookupKey(question.schoolName),
    question.degreeLevel,
    normalizeLookupText(question.majorName ?? ""),
    question.language,
    normalizeQuestionLookupKey(question.questionText)
  ].join("|");
}

function buildSchoolIndex(schools: SchoolLookup[]) {
  const index = new Map<string, SchoolLookup>();
  schools.forEach((school) => {
    [school.name, school.nameEn, school.nameZh]
      .filter((value): value is string => Boolean(value))
      .forEach((value) => getSchoolLookupKeys(value).forEach((key) => index.set(key, school)));
  });
  return index;
}

function buildMajorIndex(majors: MajorLookup[]) {
  return new Map(majors.map((major) => [createMajorKey(major.name, major.degreeLevel), major]));
}

function buildQuestionIndex(questions: QuestionLookup[]) {
  return new Map(questions.map((question) => [createQuestionKey(question), question]));
}

function getSchoolLookupKeys(value: string) {
  const keys = new Set<string>();
  const normalized = normalizeSchoolLookupKey(value);
  if (normalized) keys.add(normalized);

  for (const match of value.matchAll(/\(([^)]{2,120})\)|\uFF08([^\uFF09]{2,120})\uFF09/g)) {
    const inner = match[1] ?? match[2];
    const key = normalizeSchoolLookupKey(inner);
    if (key) keys.add(key);
  }

  return Array.from(keys);
}

function findSchool(schoolName: string, indexes: Awaited<ReturnType<typeof loadImportIndexes>>) {
  for (const key of getSchoolLookupKeys(schoolName)) {
    const school = indexes.schoolsByKey.get(key);
    if (school) return school;
  }
  return null;
}

function findMajor(majorName: string | null, degreeLevel: DegreeLevel | ParsedInterviewSheetQuestion["degreeLevel"], indexes: Awaited<ReturnType<typeof loadImportIndexes>>) {
  if (!majorName) return null;
  return indexes.majorsByKey.get(createMajorKey(majorName, degreeLevel)) ?? null;
}

async function ensureSchool(schoolName: string, indexes: Awaited<ReturnType<typeof loadImportIndexes>>, createMissing: boolean) {
  const existing = findSchool(schoolName, indexes);
  if (existing) return { created: false, item: existing };
  if (!createMissing) return null;

  const created = await prisma.school.create({
    data: {
      interviewTips: "Nguồn: Google Sheet câu hỏi phỏng vấn chính.",
      isActive: true,
      name: schoolName.slice(0, 255)
    },
    select: { id: true, name: true, nameEn: true, nameZh: true }
  });
  getSchoolLookupKeys(created.name).forEach((key) => indexes.schoolsByKey.set(key, created));
  return { created: true, item: created };
}

async function ensureMajor(
  majorName: string | null,
  degreeLevel: ParsedInterviewSheetQuestion["degreeLevel"],
  indexes: Awaited<ReturnType<typeof loadImportIndexes>>,
  createMissing: boolean
) {
  if (!majorName) return null;

  const existing = findMajor(majorName, degreeLevel, indexes);
  if (existing) return { created: false, item: existing };
  if (!createMissing) return null;

  const created = await prisma.major.create({
    data: {
      degreeLevel,
      interviewFocus: "Nguồn: Google Sheet câu hỏi phỏng vấn chính.",
      isActive: true,
      name: majorName.slice(0, 255)
    },
    select: { degreeLevel: true, id: true, name: true }
  });
  indexes.majorsByKey.set(createMajorKey(created.name, created.degreeLevel), created);
  return { created: true, item: created };
}

async function ensureSchoolMajorLink(schoolId: string, majorId: string, indexes: Awaited<ReturnType<typeof loadImportIndexes>>) {
  const key = createSchoolMajorKey(schoolId, majorId);
  if (indexes.schoolMajorLinks.has(key)) return false;

  try {
    await prisma.school_majors.create({
      data: {
        admission_season_id: null,
        major_id: majorId,
        note: "Tự động tạo khi đồng bộ Google Sheet câu hỏi phỏng vấn chính.",
        school_id: schoolId
      }
    });
    indexes.schoolMajorLinks.add(key);
    return true;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      indexes.schoolMajorLinks.add(key);
      return false;
    }
    throw error;
  }
}

function createSchoolMajorKey(schoolId: string, majorId: string) {
  return `${schoolId}:${majorId}`;
}

function createMajorKey(name: string, degreeLevel: DegreeLevel | ParsedInterviewSheetQuestion["degreeLevel"]) {
  return `${degreeLevel}:${normalizeLookupText(name)}`;
}

function createQuestionKey(input: {
  degreeLevel: DegreeLevel | ParsedInterviewSheetQuestion["degreeLevel"] | null;
  language: LanguageCode | ParsedInterviewSheetQuestion["language"];
  majorId: string | null;
  questionText: string;
  schoolId: string | null;
}) {
  return [
    input.schoolId ?? "",
    input.majorId ?? "",
    input.degreeLevel ?? "",
    input.language,
    normalizeQuestionLookupKey(input.questionText)
  ].join("|");
}

function buildQuestionData(question: ParsedInterviewSheetQuestion, schoolId: string, majorId: string | null) {
  const sourceNote = `Nguồn: Google Sheet câu hỏi phỏng vấn chính, dòng ${question.sourceRow}, cột ${question.sourceColumn}${question.sourceColumnName ? ` (${question.sourceColumnName})` : ""}${question.majorName ? `, ngành ${question.majorName}` : ""}.`;

  return {
    category: question.category ?? inferCategory(question.questionText),
    commonMistakes: question.commonMistakes ?? null,
    degreeLevel: question.degreeLevel,
    difficulty: question.difficulty ?? inferDifficulty(question.questionText),
    keywords: buildKeywords(question),
    language: question.language,
    majorId,
    questionText: question.questionText,
    sampleAnswer: question.sampleAnswer ?? null,
    scoringRubric: question.scoringRubric === undefined || question.scoringRubric === null ? Prisma.JsonNull : toJson(question.scoringRubric),
    schoolId,
    suggestedAnswerLogic: question.suggestedAnswerLogic ? `${question.suggestedAnswerLogic}\n${sourceNote}` : sourceNote
  };
}

function buildKeywords(question: ParsedInterviewSheetQuestion) {
  if (question.keywords?.trim()) return question.keywords.trim();

  return [
    "google-sheet-chinh",
    question.questionCode,
    question.schoolName,
    question.majorName,
    question.degreeLevel === "MASTER" ? "thạc sĩ" : "đại học"
  ].filter(Boolean).join(", ");
}

function inferCategory(questionText: string): QuestionCategory {
  const normalized = normalizeLookupText(questionText);
  if (/(gioi thieu|tu gioi thieu|introduce|self introduction|自我介绍)/i.test(questionText) || normalized.includes("gioi thieu ban than")) return QuestionCategory.PERSONAL;
  if (/(hoc bong|scholarship|奖学金)/i.test(questionText) || normalized.includes("hoc bong")) return QuestionCategory.SCHOLARSHIP;
  if (/(ke hoach hoc|study plan|学习计划|研究计划)/i.test(questionText) || normalized.includes("ke hoach hoc")) return QuestionCategory.STUDY_PLAN;
  if (/(nghien cuu|research|luan van|论文|研究)/i.test(questionText) || normalized.includes("nghien cuu")) return QuestionCategory.RESEARCH;
  if (/(sau khi tot nghiep|career|职业|毕业以后|毕业后)/i.test(questionText) || normalized.includes("sau khi tot nghiep")) return QuestionCategory.CAREER_PLAN;
  if (/(hsk|hskk|tieng trung|tieng anh|english|language|汉语|中文|英语)/i.test(questionText) || normalized.includes("tieng trung")) return QuestionCategory.LANGUAGE;
  if (/(truong|nganh|school|university|major|专业|学校)/i.test(questionText) || normalized.includes("chon truong") || normalized.includes("chon nganh")) return QuestionCategory.SCHOOL_MAJOR;
  if (/(neu|if|如果|tinh huong)/i.test(questionText) || normalized.startsWith("neu ")) return QuestionCategory.SITUATION;
  return QuestionCategory.OTHER;
}

function inferDifficulty(questionText: string): DifficultyLevel {
  const normalized = normalizeLookupText(questionText);
  if (normalized.includes("gioi thieu ban than") || /自我介绍/.test(questionText)) return DifficultyLevel.EASY;
  if (questionText.length > 220 || /(nghien cuu|luan van|research|论文|研究|专业知识|kien thuc chuyen nganh)/i.test(questionText)) return DifficultyLevel.HARD;
  return DifficultyLevel.MEDIUM;
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
