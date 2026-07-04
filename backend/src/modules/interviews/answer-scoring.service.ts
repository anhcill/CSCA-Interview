import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { scoreInterviewAnswerWithAi, type DetailedScore } from "../ai/ai.service.js";
import { buildInterviewRagContext } from "./rag-context.service.js";
import { checkAiCallBudget } from "./interviews.service.js";

const answerScoringInclude = {
  session: true,
  sessionQuestion: {
    include: {
      question: {
        select: {
          commonMistakes: true,
          keywords: true,
          sampleAnswer: true,
          scoringRubric: true,
          suggestedAnswerLogic: true,
          major: { select: { name: true } },
          scholarship: { select: { name: true } },
          school: { select: { name: true } }
        }
      }
    }
  }
} satisfies Prisma.InterviewAnswerInclude;

export type AnswerScoringPendingResult = {
  answerId: string;
  reason: string;
  reasonCode: "answer_not_found" | "ai_budget_exceeded" | "ai_unavailable";
  sessionQuestionId: string;
  source: "pending";
  status: "pending";
};

export type AnswerScoringReadyResult = {
  answerId: string;
  evaluation: DetailedScore;
  feedback: string;
  improvedAnswer: string;
  score: number;
  scores: {
    confidence: number;
    content: number;
    expertise: number;
    impression: number;
    language: number;
    logic: number;
    total: number;
  };
  sessionQuestionId: string;
  source: "ai";
  status: "scored";
  strengths: string[];
  weaknesses: string[];
};

export type AnswerScoringResult = AnswerScoringPendingResult | AnswerScoringReadyResult;

export async function scoreInterviewAnswerForSession(input: {
  answerId: string;
  sessionId: string;
  userId: string;
}): Promise<AnswerScoringResult> {
  const answer = await prisma.interviewAnswer.findFirst({
    where: {
      id: input.answerId,
      sessionId: input.sessionId,
      userId: input.userId
    },
    include: answerScoringInclude
  });

  if (!answer?.answerText?.trim()) {
    return {
      answerId: input.answerId,
      reason: "Chưa có câu trả lời hợp lệ để chấm điểm.",
      reasonCode: "answer_not_found",
      sessionQuestionId: answer?.sessionQuestionId ?? "",
      source: "pending",
      status: "pending"
    };
  }

  const aiBudget = await checkAiCallBudget(input.userId);
  if (!aiBudget.ok) {
    return {
      answerId: answer.id,
      reason: aiBudget.message,
      reasonCode: "ai_budget_exceeded",
      sessionQuestionId: answer.sessionQuestionId,
      source: "pending",
      status: "pending"
    };
  }

  const ragContext = await buildInterviewRagContext({
    majorId: answer.session.majorId,
    schoolId: answer.session.schoolId,
    scholarshipId: answer.session.scholarshipId,
    scholarshipType: answer.session.scholarshipType,
    targetMajor: answer.session.targetMajor,
    targetSchool: answer.session.targetSchool
  });

  const sessionQuestion = answer.sessionQuestion;
  const sourceQuestion = sessionQuestion.question;
  const evaluation = await scoreInterviewAnswerWithAi({
    answerText: answer.answerText.trim(),
    commonMistakes: sourceQuestion?.commonMistakes ?? null,
    expectedAnswerLogic: sessionQuestion.expectedAnswerLogic ?? sourceQuestion?.suggestedAnswerLogic ?? null,
    keywords: sourceQuestion?.keywords ?? null,
    language: sessionQuestion.language,
    questionText: sessionQuestion.questionText,
    ragContext: ragContext.contextText,
    sampleAnswer: sourceQuestion?.sampleAnswer ?? null,
    scholarshipType: sourceQuestion?.scholarship?.name ?? answer.session.scholarshipType,
    scoringRubric: sourceQuestion?.scoringRubric ?? null,
    targetMajor: sourceQuestion?.major?.name ?? answer.session.targetMajor,
    targetSchool: sourceQuestion?.school?.name ?? answer.session.targetSchool,
    userId: input.userId
  });

  if (evaluation.scoringSource !== "ai") {
    return {
      answerId: answer.id,
      reason: "AI chưa trả về điểm chính thức; câu trả lời đã được lưu và đang chờ chấm.",
      reasonCode: "ai_unavailable",
      sessionQuestionId: answer.sessionQuestionId,
      source: "pending",
      status: "pending"
    };
  }

  await prisma.interviewAnswer.update({
    where: { id: answer.id },
    data: {
      feedback: evaluation.feedback,
      improvedAnswer: evaluation.improvedAnswer,
      scoreLanguage: evaluation.language,
      scoreLogic: evaluation.logic,
      scoreRelevance: evaluation.expertise,
      scoreSpecificity: evaluation.content,
      scoreTotal: evaluation.total,
      strengths: evaluation.strengths.join("\n"),
      weaknesses: evaluation.weaknesses.join("\n")
    }
  });

  return {
    answerId: answer.id,
    evaluation,
    feedback: evaluation.feedback,
    improvedAnswer: evaluation.improvedAnswer,
    score: evaluation.total,
    scores: {
      confidence: evaluation.confidence,
      content: evaluation.content,
      expertise: evaluation.expertise,
      impression: evaluation.impression,
      language: evaluation.language,
      logic: evaluation.logic,
      total: evaluation.total
    },
    sessionQuestionId: answer.sessionQuestionId,
    source: "ai",
    status: "scored",
    strengths: evaluation.strengths,
    weaknesses: evaluation.weaknesses
  };
}
