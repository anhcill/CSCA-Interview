import { Prisma, type Major, type Scholarship } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { normalizeSearchText, rankSearchCandidate } from "../../utils/search-normalize.js";

type RagTargetInput = {
  majorId?: string | null;
  schoolId?: string | null;
  scholarshipId?: string | null;
  scholarshipType?: string | null;
  targetMajor?: string | null;
  targetSchool?: string | null;
};

const maxContextLength = 6000;

export type InterviewRagContext = {
  contextText: string | null;
  majorId: string | null;
  scholarshipId: string | null;
  schoolId: string | null;
};

export async function buildInterviewRagContext(input: RagTargetInput): Promise<InterviewRagContext> {
  const [school, major, scholarship] = await Promise.all([
    findSchoolTarget(input.schoolId, input.targetSchool),
    findMajorTarget(input.majorId, input.targetMajor),
    findScholarshipTarget(input.scholarshipId, input.scholarshipType)
  ]);

  const sections = [
    buildSchoolSection(school),
    buildMajorSection(major),
    buildScholarshipSection(scholarship)
  ].filter(Boolean);

  const contextText = sections.length
    ? [
        "Database RAG context. Use this as factual background for asking and grading. Do not invent facts beyond it.",
        ...sections
      ].join("\n\n").slice(0, maxContextLength)
    : null;

  return {
    contextText,
    majorId: major?.id ?? null,
    scholarshipId: scholarship?.id ?? null,
    schoolId: school?.id ?? null
  };
}

function cleanTargetName(value?: string | null) {
  const cleaned = value?.trim();
  const normalized = normalizeSearchText(cleaned ?? "");
  if (!cleaned || ["truong ban apply", "nganh ban apply", "hoc bong muc tieu"].includes(normalized)) return null;
  return cleaned;
}

function cleanTargetId(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)
    ? cleaned
    : null;
}

async function findSchoolTarget(id?: string | null, name?: string | null) {
  const targetId = cleanTargetId(id);
  if (targetId) {
    const school = await prisma.school.findFirst({
      where: { id: targetId, isActive: true },
      include: schoolContextInclude
    });
    if (school) return school;
  }

  const target = cleanTargetName(name);
  if (!target) return null;

  const exact = await prisma.school.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { equals: target, mode: "insensitive" } },
        { nameEn: { equals: target, mode: "insensitive" } },
        { nameZh: { equals: target, mode: "insensitive" } }
      ]
    },
    include: schoolContextInclude
  });
  if (exact) return exact;

  const candidates = await prisma.school.findMany({
    where: { isActive: true },
    include: schoolContextInclude,
    orderBy: { name: "asc" },
    take: 2000
  });

  return candidates
    .map((school) => ({
      rank: rankSearchCandidate(target, [
        school.name,
        school.nameEn,
        school.nameZh,
        school.city,
        school.province,
        school.strongMajors,
        school.researchAreas,
        school.programLanguage,
        school.campusInfo,
        school.achievements
      ]),
      school
    }))
    .filter((entry) => entry.rank > 0)
    .sort((left, right) => right.rank - left.rank)[0]?.school ?? null;
}

async function findMajorTarget(id?: string | null, name?: string | null) {
  const targetId = cleanTargetId(id);
  if (targetId) {
    const major = await prisma.major.findFirst({
      where: { id: targetId, isActive: true }
    });
    if (major) return major;
  }

  const target = cleanTargetName(name);
  if (!target) return null;

  const exact = await prisma.major.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { equals: target, mode: "insensitive" } },
        { nameEn: { equals: target, mode: "insensitive" } },
        { nameZh: { equals: target, mode: "insensitive" } }
      ]
    }
  });
  if (exact) return exact;

  const candidates = await prisma.major.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 1000
  });

  return candidates
    .map((major) => ({
      rank: rankSearchCandidate(target, [
        major.name,
        major.nameEn,
        major.nameZh,
        major.description,
        major.requirements,
        major.researchAreas,
        major.researchLabs,
        major.interviewFocus
      ]),
      major
    }))
    .filter((entry) => entry.rank > 0)
    .sort((left, right) => right.rank - left.rank)[0]?.major ?? null;
}

async function findScholarshipTarget(id?: string | null, name?: string | null) {
  const targetId = cleanTargetId(id);
  if (targetId) {
    const scholarship = await prisma.scholarship.findFirst({
      where: { id: targetId, isActive: true }
    });
    if (scholarship) return scholarship;
  }

  const target = cleanTargetName(name);
  if (!target) return null;

  const exact = await prisma.scholarship.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { equals: target, mode: "insensitive" } },
        { code: { equals: target, mode: "insensitive" } }
      ]
    }
  });
  if (exact) return exact;

  const candidates = await prisma.scholarship.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 1000
  });

  return candidates
    .map((scholarship) => ({
      rank: rankSearchCandidate(target, [
        scholarship.name,
        scholarship.code,
        scholarship.description,
        scholarship.requirements,
        scholarship.coverage,
        scholarship.studyPlanRequirements,
        scholarship.interviewFormat,
        scholarship.tips
      ]),
      scholarship
    }))
    .filter((entry) => entry.rank > 0)
    .sort((left, right) => right.rank - left.rank)[0]?.scholarship ?? null;
}

const schoolContextInclude = {
  school_majors: {
    include: {
      majors: true
    },
    take: 8
  },
  school_scholarships: {
    include: {
      scholarships: true
    },
    take: 8
  }
} satisfies Prisma.SchoolInclude;

type SchoolContext = Prisma.SchoolGetPayload<{ include: typeof schoolContextInclude }>;
type MajorContext = Major;
type ScholarshipContext = Scholarship;

function buildSchoolSection(school: SchoolContext | null) {
  if (!school) return null;

  return compactLines([
    `School: ${school.name}${school.nameZh ? ` (${school.nameZh})` : ""}${school.nameEn && school.nameEn !== school.name ? ` / ${school.nameEn}` : ""}`,
    school.ranking ? `- Ranking: #${school.ranking}${school.rankingType ? ` ${school.rankingType}` : ""}` : null,
    joinText("- Location:", [school.city, school.province]),
    textLine("- Program language:", school.programLanguage),
    textLine("- Strong majors:", school.strongMajors),
    textLine("- Research areas:", school.researchAreas),
    textLine("- Admission requirements:", school.admissionRequirements),
    textLine("- Campus info:", school.campusInfo),
    textLine("- Achievements:", school.achievements),
    textLine("- Notable alumni:", school.notableAlumni),
    textLine("- Interview tips:", school.interviewTips),
    school.school_majors.length
      ? `- Linked majors: ${school.school_majors.map((item) => item.majors.name).join("; ")}`
      : null,
    school.school_scholarships.length
      ? `- Linked scholarships: ${school.school_scholarships.map((item) => item.scholarships.name).join("; ")}`
      : null,
    textLine("- Description:", school.description)
  ]);
}

function buildMajorSection(major: MajorContext | null) {
  if (!major) return null;

  return compactLines([
    `Major: ${major.name}${major.nameZh ? ` (${major.nameZh})` : ""}${major.nameEn && major.nameEn !== major.name ? ` / ${major.nameEn}` : ""}`,
    `- Degree level: ${major.degreeLevel}`,
    textLine("- Requirements:", major.requirements),
    textLine("- Research areas:", major.researchAreas),
    textLine("- Research labs:", major.researchLabs),
    textLine("- Career outcomes:", major.careerOutcomes),
    textLine("- Interview focus:", major.interviewFocus),
    textLine("- Description:", major.description)
  ]);
}

function buildScholarshipSection(scholarship: ScholarshipContext | null) {
  if (!scholarship) return null;

  return compactLines([
    `Scholarship: ${scholarship.name}${scholarship.code ? ` (${scholarship.code})` : ""}`,
    textLine("- Requirements:", scholarship.requirements),
    textLine("- Deadline:", scholarship.deadline),
    textLine("- Coverage:", scholarship.coverage),
    textLine("- Study plan requirements:", scholarship.studyPlanRequirements),
    textLine("- Interview format:", scholarship.interviewFormat),
    textLine("- Common interview questions:", formatJsonList(scholarship.commonInterviewQuestions)),
    textLine("- Tips:", scholarship.tips),
    textLine("- Description:", scholarship.description)
  ]);
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter((line): line is string => Boolean(line?.trim())).join("\n");
}

function textLine(label: string, value?: string | null) {
  return value?.trim() ? `${label} ${value.trim()}` : null;
}

function joinText(label: string, values: Array<string | null | undefined>) {
  const text = values.map((value) => value?.trim()).filter(Boolean).join(", ");
  return text ? `${label} ${text}` : null;
}

function formatJsonList(value: Prisma.JsonValue | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === "string" ? item : JSON.stringify(item))
      .slice(0, 10)
      .join("; ");
  }
  return JSON.stringify(value);
}
