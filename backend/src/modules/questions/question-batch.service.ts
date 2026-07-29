import {
  DegreeLevel,
  DifficultyLevel,
  LanguageCode,
  Prisma,
  QuestionCategory
} from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export type BatchQuestionInput = {
  category?: QuestionCategory;
  commonMistakes?: string | null;
  degreeLevel?: DegreeLevel | null;
  difficulty?: DifficultyLevel;
  isActive?: boolean;
  keywords?: string | null;
  language?: LanguageCode;
  questionText: string;
  sampleAnswer?: string | null;
  scholarshipId?: string | null;
  scoringRubric?: Prisma.InputJsonValue | null;
  suggestedAnswerLogic?: string | null;
};

export type CreateQuestionBatchInput = {
  majorId: string;
  questions: BatchQuestionInput[];
  reuseQuestionIds: string[];
  schoolId: string;
  userId: string;
};

export function normalizeQuestionText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

export function deduplicateBatchQuestions(questions: BatchQuestionInput[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = normalizeQuestionText(question.questionText);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function createQuestionBatch(input: CreateQuestionBatchInput) {
  const uniqueQuestions = deduplicateBatchQuestions(input.questions);
  const uniqueReuseIds = [...new Set(input.reuseQuestionIds)];

  return prisma.$transaction(async (tx) => {
    const [school, major] = await Promise.all([
      tx.school.findFirst({
        where: { id: input.schoolId, isActive: true },
        select: { id: true }
      }),
      tx.major.findFirst({
        where: { id: input.majorId, isActive: true },
        select: { degreeLevel: true, id: true }
      })
    ]);

    if (!school) throw new Error("SCHOOL_NOT_FOUND");
    if (!major) throw new Error("MAJOR_NOT_FOUND");

    const schoolMajor = await tx.school_majors.findFirst({
      where: {
        admission_season_id: null,
        major_id: input.majorId,
        school_id: input.schoolId
      },
      select: { id: true }
    });

    if (!schoolMajor) {
      await tx.school_majors.create({
        data: {
          admission_season_id: null,
          major_id: input.majorId,
          note: "Tạo tự động khi admin nhập bộ câu hỏi",
          school_id: input.schoolId
        }
      });
    }

    const existingQuestions = await tx.question.findMany({
      where: {
        deletedAt: null,
        OR: [
          { majorId: input.majorId, schoolId: input.schoolId },
          {
            assignments: {
              some: {
                majorId: input.majorId,
                schoolId: input.schoolId
              }
            }
          }
        ]
      },
      select: { questionText: true }
    });
    const existingTexts = new Set(existingQuestions.map((question) => normalizeQuestionText(question.questionText)));
    const questionsToCreate = uniqueQuestions.filter((question) => !existingTexts.has(normalizeQuestionText(question.questionText)));

    const createdIds: string[] = [];
    for (const question of questionsToCreate) {
      const created = await tx.question.create({
        data: {
          category: question.category ?? QuestionCategory.OTHER,
          commonMistakes: question.commonMistakes ?? null,
          createdBy: input.userId,
          degreeLevel: question.degreeLevel ?? major.degreeLevel,
          difficulty: question.difficulty ?? DifficultyLevel.MEDIUM,
          isActive: question.isActive ?? true,
          keywords: question.keywords ?? null,
          language: question.language ?? LanguageCode.VI,
          majorId: input.majorId,
          questionText: question.questionText.trim(),
          sampleAnswer: question.sampleAnswer ?? null,
          scholarshipId: question.scholarshipId ?? null,
          scoringRubric: question.scoringRubric === null
            ? Prisma.JsonNull
            : question.scoringRubric,
          schoolId: input.schoolId,
          suggestedAnswerLogic: question.suggestedAnswerLogic ?? null,
          assignments: {
            create: {
              createdBy: input.userId,
              majorId: input.majorId,
              schoolId: input.schoolId
            }
          }
        },
        select: { id: true }
      });
      createdIds.push(created.id);
    }

    const reusableQuestions = uniqueReuseIds.length
      ? await tx.question.findMany({
          where: {
            deletedAt: null,
            id: { in: uniqueReuseIds },
            isActive: true
          },
          select: { id: true }
        })
      : [];

    const reused = reusableQuestions.length
      ? await tx.questionAssignment.createMany({
          data: reusableQuestions.map((question) => ({
            createdBy: input.userId,
            majorId: input.majorId,
            questionId: question.id,
            schoolId: input.schoolId
          })),
          skipDuplicates: true
        })
      : { count: 0 };

    return {
      created: createdIds.length,
      duplicateNewQuestions: uniqueQuestions.length - questionsToCreate.length,
      reused: reused.count,
      skippedReuseQuestions: uniqueReuseIds.length - reusableQuestions.length
    };
  });
}

export async function syncQuestionTarget(input: {
  majorId: string | null | undefined;
  questionId: string;
  schoolId: string | null | undefined;
  userId: string;
}) {
  if (!input.schoolId || !input.majorId) return;

  await prisma.$transaction(async (tx) => {
    const schoolMajor = await tx.school_majors.findFirst({
      where: {
        admission_season_id: null,
        major_id: input.majorId!,
        school_id: input.schoolId!
      },
      select: { id: true }
    });

    if (!schoolMajor) {
      await tx.school_majors.create({
        data: {
          admission_season_id: null,
          major_id: input.majorId!,
          note: "Tạo tự động từ kho câu hỏi",
          school_id: input.schoolId!
        }
      });
    }

    await tx.questionAssignment.upsert({
      create: {
        createdBy: input.userId,
        majorId: input.majorId!,
        questionId: input.questionId,
        schoolId: input.schoolId!
      },
      update: {},
      where: {
        questionId_schoolId_majorId: {
          majorId: input.majorId!,
          questionId: input.questionId,
          schoolId: input.schoolId!
        }
      }
    });
  });
}
