import { DifficultyLevel, QuestionCategory } from "@prisma/client";
import { normalizeLookupText, normalizeQuestionLookupKey, type ParsedInterviewSheetQuestion } from "./interview-sheet-parser.js";

export type NormalizedMasterSheetIssue = {
  code: string;
  message: string;
  preview?: string;
  questionCode?: string | null;
  severity: "error" | "warning";
  sourceColumn?: number;
  sourceColumnName?: string | null;
  sourceRow: number;
};

export type NormalizedMasterSheetSkippedRow = {
  questionCode?: string | null;
  reason: string;
  sourceRow: number;
  status?: string | null;
};

export type NormalizedMasterSheetParseResult = {
  headerRow: number;
  issues: NormalizedMasterSheetIssue[];
  questions: ParsedInterviewSheetQuestion[];
  skippedRows: NormalizedMasterSheetSkippedRow[];
  stats: {
    generatedRecords: number;
    readyRows: number;
    sourceRows: number;
    skippedRows: number;
  };
};

type ColumnKey =
  | "answerEn"
  | "answerZh"
  | "category"
  | "code"
  | "degreeLevel"
  | "difficulty"
  | "keywords"
  | "lockTranslation"
  | "major"
  | "mistakes"
  | "note"
  | "originalLanguage"
  | "originalQuestion"
  | "questionEn"
  | "questionZh"
  | "rubricCode"
  | "rubricJson"
  | "school"
  | "schoolAlias"
  | "sourceRow"
  | "sourceSheet"
  | "status"
  | "suggestedLogic"
  | "year";

type ColumnInfo = {
  header: string;
  index: number;
};

const columnAliases: Record<ColumnKey, string[]> = {
  answerEn: ["goi_y_tra_loi_tieng_anh", "cau_tra_loi_mau_tieng_anh", "sample_answer_en", "answer_en"],
  answerZh: ["goi_y_tra_loi_tieng_trung", "cau_tra_loi_mau_tieng_trung", "sample_answer_zh", "answer_zh"],
  category: ["danh_muc", "category", "loai_cau_hoi"],
  code: ["ma_cau_hoi", "question_code", "id"],
  degreeLevel: ["bac_hoc", "degree_level", "he_hoc"],
  difficulty: ["do_kho", "difficulty"],
  keywords: ["tu_khoa", "keywords", "keyword"],
  lockTranslation: ["khoa_ban_dich", "lock_translation"],
  major: ["nganh_chuan", "nganh", "major", "major_name"],
  mistakes: ["loi_thuong_gap", "common_mistakes", "diem_tru"],
  note: ["ghi_chu", "note", "notes"],
  originalLanguage: ["ngon_ngu_goc", "original_language", "source_language"],
  originalQuestion: ["cau_hoi_goc", "original_question", "source_question"],
  questionEn: ["cau_hoi_tieng_anh", "question_en", "english_question"],
  questionZh: ["cau_hoi_tieng_trung", "question_zh", "chinese_question"],
  rubricCode: ["rubric_code", "ma_rubric"],
  rubricJson: ["rubric_json", "scoring_rubric", "rubric"],
  school: ["truong_chuan", "truong", "school", "school_name"],
  schoolAlias: ["alias_truong", "ten_khac_cua_truong", "school_alias"],
  sourceRow: ["nguon_dong", "source_row"],
  sourceSheet: ["nguon_sheet", "source_sheet"],
  status: ["trang_thai", "status"],
  suggestedLogic: ["logic_cham_diem", "goi_y_logic_tra_loi", "suggested_answer_logic"],
  year: ["nam", "year", "mua_tuyen_sinh"]
};

const readyStatusKeys = new Set(["san_sang_import", "ready", "ready_import", "approved", "da_duyet", "import", "ok"]);

const categoryByKey = new Map<string, QuestionCategory>([
  ["personal", QuestionCategory.PERSONAL],
  ["ca_nhan", QuestionCategory.PERSONAL],
  ["gioi_thieu", QuestionCategory.PERSONAL],
  ["academic", QuestionCategory.ACADEMIC],
  ["hoc_thuat", QuestionCategory.ACADEMIC],
  ["study_plan", QuestionCategory.STUDY_PLAN],
  ["ke_hoach_hoc_tap", QuestionCategory.STUDY_PLAN],
  ["scholarship", QuestionCategory.SCHOLARSHIP],
  ["hoc_bong", QuestionCategory.SCHOLARSHIP],
  ["career_plan", QuestionCategory.CAREER_PLAN],
  ["ke_hoach_nghe_nghiep", QuestionCategory.CAREER_PLAN],
  ["language", QuestionCategory.LANGUAGE],
  ["ngon_ngu", QuestionCategory.LANGUAGE],
  ["situation", QuestionCategory.SITUATION],
  ["tinh_huong", QuestionCategory.SITUATION],
  ["research", QuestionCategory.RESEARCH],
  ["nghien_cuu", QuestionCategory.RESEARCH],
  ["school_major", QuestionCategory.SCHOOL_MAJOR],
  ["truong_nganh", QuestionCategory.SCHOOL_MAJOR],
  ["other", QuestionCategory.OTHER],
  ["khac", QuestionCategory.OTHER]
]);

const difficultyByKey = new Map<string, DifficultyLevel>([
  ["easy", DifficultyLevel.EASY],
  ["de", DifficultyLevel.EASY],
  ["medium", DifficultyLevel.MEDIUM],
  ["tb", DifficultyLevel.MEDIUM],
  ["trung_binh", DifficultyLevel.MEDIUM],
  ["hard", DifficultyLevel.HARD],
  ["kho", DifficultyLevel.HARD]
]);

export function parseNormalizedMasterSheetCsv(csv: string): NormalizedMasterSheetParseResult | null {
  const rows = parseCsvRows(csv);
  const header = findHeaderRow(rows);
  if (!header) return null;

  const questions: ParsedInterviewSheetQuestion[] = [];
  const issues: NormalizedMasterSheetIssue[] = [];
  const skippedRows: NormalizedMasterSheetSkippedRow[] = [];
  let readyRows = 0;
  let sourceRows = 0;

  rows.slice(header.rowIndex + 1).forEach((row, offset) => {
    const sourceRow = header.rowIndex + offset + 2;
    if (isEmptyRow(row)) return;

    sourceRows += 1;
    const rowIssues: NormalizedMasterSheetIssue[] = [];
    const questionCode = readCell(row, header.columns, "code") || null;
    const rawStatus = readCell(row, header.columns, "status") || "sẵn_sàng_import";
    const statusKey = normalizeKey(rawStatus);

    if (!readyStatusKeys.has(statusKey)) {
      skippedRows.push({
        questionCode,
        reason: `Trạng thái "${rawStatus}" chưa sẵn sàng import.`,
        sourceRow,
        status: rawStatus
      });
      return;
    }

    readyRows += 1;
    const schoolName = readCell(row, header.columns, "school");
    const degreeLevel = normalizeDegreeLevel(readCell(row, header.columns, "degreeLevel"));
    const majorName = readCell(row, header.columns, "major") || null;
    const originalQuestion = readCell(row, header.columns, "originalQuestion");
    const originalLanguage = normalizeLanguage(readCell(row, header.columns, "originalLanguage")) ?? inferLanguageFromText(originalQuestion);
    const questionZh = readCell(row, header.columns, "questionZh") || (originalLanguage === "ZH" ? originalQuestion : "");
    const questionEn = readCell(row, header.columns, "questionEn") || (originalLanguage === "EN" ? originalQuestion : "");
    const rubricCode = readCell(row, header.columns, "rubricCode");
    const rubricJson = readCell(row, header.columns, "rubricJson");
    const scoringRubric = parseScoringRubric(rubricJson, rubricCode, rowIssues, sourceRow, header.columns.rubricJson);
    const category = normalizeCategory(readCell(row, header.columns, "category"), rowIssues, sourceRow, header.columns.category);
    const difficulty = normalizeDifficulty(readCell(row, header.columns, "difficulty"), rowIssues, sourceRow, header.columns.difficulty);

    if (!schoolName) {
      rowIssues.push(createIssue("error", "MISSING_SCHOOL", "Thiếu trường_chuẩn.", sourceRow, header.columns.school, questionCode));
    }
    if (!degreeLevel) {
      rowIssues.push(createIssue("error", "MISSING_DEGREE_LEVEL", "Thiếu hoặc sai bậc_học. Chỉ nhận Đại học/BACHELOR hoặc Thạc sĩ/MASTER.", sourceRow, header.columns.degreeLevel, questionCode));
    }
    if (!questionZh && !questionEn) {
      rowIssues.push(createIssue("error", "MISSING_INTERVIEW_LANGUAGE", "Thiếu câu hỏi tiếng Trung và tiếng Anh. Phỏng vấn chỉ import ZH/EN, không import câu tiếng Việt.", sourceRow, header.columns.questionZh ?? header.columns.questionEn, questionCode, originalQuestion));
    }

    if (rowIssues.some((issue) => issue.severity === "error")) {
      issues.push(...rowIssues);
      return;
    }

    issues.push(...rowIssues);
    const shared = {
      category,
      commonMistakes: readCell(row, header.columns, "mistakes") || null,
      degreeLevel: degreeLevel!,
      difficulty,
      keywords: readCell(row, header.columns, "keywords") || null,
      majorName,
      questionCode,
      schoolName,
      scoringRubric,
      suggestedAnswerLogic: buildSuggestedLogic(row, header.columns, sourceRow, questionCode)
    };

    if (questionZh) {
      const answer = readCell(row, header.columns, "answerZh") || null;
      if (!answer) {
        issues.push(createIssue("warning", "MISSING_SAMPLE_ANSWER_ZH", "Câu tiếng Trung chưa có gợi ý trả lời tiếng Trung.", sourceRow, header.columns.answerZh, questionCode, questionZh));
      }
      questions.push({
        ...shared,
        language: "ZH",
        questionText: questionZh,
        sampleAnswer: answer,
        sourceColumn: (header.columns.questionZh?.index ?? 0) + 1,
        sourceColumnName: header.columns.questionZh?.header ?? "câu_hỏi_tiếng_trung",
        sourceRow
      });
    }

    if (questionEn) {
      const answer = readCell(row, header.columns, "answerEn") || null;
      if (!answer) {
        issues.push(createIssue("warning", "MISSING_SAMPLE_ANSWER_EN", "Câu tiếng Anh chưa có gợi ý trả lời tiếng Anh.", sourceRow, header.columns.answerEn, questionCode, questionEn));
      }
      questions.push({
        ...shared,
        language: "EN",
        questionText: questionEn,
        sampleAnswer: answer,
        sourceColumn: (header.columns.questionEn?.index ?? 0) + 1,
        sourceColumnName: header.columns.questionEn?.header ?? "câu_hỏi_tiếng_anh",
        sourceRow
      });
    }
  });

  return {
    headerRow: header.rowIndex + 1,
    issues,
    questions,
    skippedRows,
    stats: {
      generatedRecords: questions.length,
      readyRows,
      skippedRows: skippedRows.length,
      sourceRows
    }
  };
}

function findHeaderRow(rows: string[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
    const cells = rows[rowIndex].map(normalizeKey);
    const hasCode = cells.includes("ma_cau_hoi") || cells.includes("question_code");
    const hasSchool = cells.includes("truong_chuan") || cells.includes("school");
    const hasQuestion = cells.includes("cau_hoi_tieng_trung") || cells.includes("cau_hoi_tieng_anh") || cells.includes("question_zh") || cells.includes("question_en");
    if (!hasCode || !hasSchool || !hasQuestion) continue;

    return {
      columns: buildColumns(rows[rowIndex]),
      rowIndex
    };
  }
  return null;
}

function buildColumns(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeKey);
  const columns = {} as Partial<Record<ColumnKey, ColumnInfo>>;

  (Object.keys(columnAliases) as ColumnKey[]).forEach((key) => {
    const index = normalizedHeaders.findIndex((header) => columnAliases[key].includes(header));
    if (index >= 0) columns[key] = { header: headers[index], index };
  });

  return columns;
}

function readCell(row: string[], columns: Partial<Record<ColumnKey, ColumnInfo>>, key: ColumnKey) {
  const column = columns[key];
  if (!column) return "";
  return cleanCell(row[column.index] ?? "");
}

function parseCsvRows(csv: string) {
  const normalized = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(cleanCell(cell));
      cell = "";
    } else if (char === "\n") {
      row.push(cleanCell(cell));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cleanCell(cell));
    rows.push(row);
  }

  return rows;
}

function cleanCell(value: string) {
  return value.replace(/\u00a0/g, " ").trim();
}

function normalizeKey(value: string) {
  return normalizeLookupText(value)
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isEmptyRow(row: string[]) {
  return row.every((cell) => !cleanCell(cell));
}

function normalizeDegreeLevel(value: string): ParsedInterviewSheetQuestion["degreeLevel"] | null {
  const key = normalizeKey(value);
  if (["master", "thac_si", "thac_sĩ", "ths"].includes(key) || key.includes("thac")) return "MASTER";
  if (["bachelor", "dai_hoc", "đai_hoc", "dh"].includes(key) || key.includes("dai_hoc")) return "BACHELOR";
  return null;
}

function normalizeLanguage(value: string): ParsedInterviewSheetQuestion["language"] | null {
  const key = normalizeKey(value);
  if (!key) return null;
  if (["zh", "cn", "chinese", "tieng_trung", "trung"].includes(key) || key.includes("trung")) return "ZH";
  if (["en", "english", "tieng_anh", "anh"].includes(key) || key.includes("tieng_anh")) return "EN";
  if (["vi", "vn", "vietnamese", "tieng_viet", "viet"].includes(key) || key.includes("viet")) return "VI";
  return null;
}

function inferLanguageFromText(value: string): ParsedInterviewSheetQuestion["language"] | null {
  if (/[\u3400-\u9FFF\uF900-\uFAFF]/u.test(value)) return "ZH";
  const normalized = normalizeLookupText(value);
  if (/^(what|why|how|could|please|if|tell|do you|can you|would you|which|where|when)\b/.test(normalized)) return "EN";
  if (value) return "VI";
  return null;
}

function normalizeCategory(value: string, issues: NormalizedMasterSheetIssue[], sourceRow: number, column?: ColumnInfo) {
  if (!value) return undefined;
  const key = normalizeKey(value);
  const category = categoryByKey.get(key);
  if (category) return category;
  issues.push(createIssue("warning", "UNKNOWN_CATEGORY", `Danh mục "${value}" chưa khớp enum, hệ thống sẽ tự suy luận.`, sourceRow, column));
  return undefined;
}

function normalizeDifficulty(value: string, issues: NormalizedMasterSheetIssue[], sourceRow: number, column?: ColumnInfo) {
  if (!value) return undefined;
  const key = normalizeKey(value);
  const difficulty = difficultyByKey.get(key);
  if (difficulty) return difficulty;
  issues.push(createIssue("warning", "UNKNOWN_DIFFICULTY", `Độ khó "${value}" chưa khớp enum, hệ thống sẽ dùng mặc định hoặc tự suy luận.`, sourceRow, column));
  return undefined;
}

function parseScoringRubric(
  rubricJson: string,
  rubricCode: string,
  issues: NormalizedMasterSheetIssue[],
  sourceRow: number,
  column?: ColumnInfo
) {
  if (rubricJson) {
    try {
      return JSON.parse(rubricJson) as unknown;
    } catch {
      issues.push(createIssue("error", "INVALID_RUBRIC_JSON", "rubric_json không phải JSON hợp lệ.", sourceRow, column, null, rubricJson.slice(0, 160)));
      return null;
    }
  }

  return rubricCode ? { rubricCode } : null;
}

function buildSuggestedLogic(row: string[], columns: Partial<Record<ColumnKey, ColumnInfo>>, sourceRow: number, questionCode: string | null) {
  const logic = readCell(row, columns, "suggestedLogic");
  const note = readCell(row, columns, "note");
  const sourceSheet = readCell(row, columns, "sourceSheet");
  const originalSourceRow = readCell(row, columns, "sourceRow");
  const parts = [
    logic,
    note ? `Ghi chú sheet: ${note}` : "",
    `Nguồn: CÂU_HỎI_CHUẨN dòng ${sourceRow}${questionCode ? `, mã ${questionCode}` : ""}${sourceSheet ? `, tab gốc ${sourceSheet}` : ""}${originalSourceRow ? `, dòng gốc ${originalSourceRow}` : ""}.`
  ].filter(Boolean);
  return parts.join("\n");
}

function createIssue(
  severity: NormalizedMasterSheetIssue["severity"],
  code: string,
  message: string,
  sourceRow: number,
  column?: ColumnInfo,
  questionCode?: string | null,
  preview?: string
): NormalizedMasterSheetIssue {
  return {
    code,
    message,
    preview,
    questionCode,
    severity,
    sourceColumn: column ? column.index + 1 : undefined,
    sourceColumnName: column?.header ?? null,
    sourceRow
  };
}
