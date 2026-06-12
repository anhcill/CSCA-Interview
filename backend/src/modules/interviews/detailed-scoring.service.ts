import { InterviewAnswer, InterviewSession, InterviewSessionQuestion, Question } from "@prisma/client";
import { scoreInterviewAnswerDetailed, type DetailedScore } from "../ai/ai.service.js";

export type AnswerDetailedAnalysis = {
  sessionQuestionId: string;
  questionText: string;
  answerText: string;
  scores: {
    content: number;
    logic: number;
    language: number;
    confidence: number;
    expertise: number;
    impression: number;
    total: number;
  };
  strengths: string[];
  weaknesses: string[];
  tips: string[];
  feedback: string;
  improvedAnswer: string;
  academicKeywords: string[];
  sampleComparison: {
    coveragePercent: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    notes: string[];
    sampleAnswer: string | null;
  } | null;
};

export type SessionAnalysis = {
  criteriaAverages: {
    content: number;
    logic: number;
    language: number;
    confidence: number;
    expertise: number;
    impression: number;
  };
  overallScore: number;
  progressHint: string;
  sessionSummary: string;
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];
  answerDetails: AnswerDetailedAnalysis[];
};

type AnswerWithQuestion = InterviewAnswer & {
  sessionQuestion: InterviewSessionQuestion & {
    question?: Pick<Question, "keywords" | "sampleAnswer" | "suggestedAnswerLogic"> | null;
  };
};

export function buildSessionAnalysis(
  session: InterviewSession & { answers: AnswerWithQuestion[] }
): SessionAnalysis {
  const answers = session.answers;

  // --- Per-answer detailed analysis ---
  const answerDetails: AnswerDetailedAnalysis[] = answers
    .filter((a) => a.answerText && a.answerText.trim().length > 0)
    .map((answer) => {
      const detailed: DetailedScore = scoreInterviewAnswerDetailed(answer.answerText ?? "");
      const sampleComparison = compareWithSampleAnswer(
        answer.answerText ?? "",
        answer.sessionQuestion?.question?.sampleAnswer ?? null,
        answer.sessionQuestion?.question?.keywords ?? answer.sessionQuestion?.question?.suggestedAnswerLogic ?? null
      );
      return {
        sessionQuestionId: answer.sessionQuestionId,
        questionText: answer.sessionQuestion?.questionText ?? "",
        answerText: answer.answerText ?? "",
        scores: {
          content: detailed.content,
          logic: detailed.logic,
          language: detailed.language,
          confidence: detailed.confidence,
          expertise: detailed.expertise,
          impression: detailed.impression,
          total: detailed.total,
        },
        strengths: detailed.strengths,
        weaknesses: detailed.weaknesses,
        tips: detailed.tips,
        feedback: detailed.feedback,
        improvedAnswer: detailed.improvedAnswer,
        academicKeywords: detailed.academicKeywords,
        sampleComparison,
      };
    });

  // --- Criteria averages from DB scores (fallback to detailed) ---
  const scores = answers.map((answer) => {
    const detail = answerDetails.find((d) => d.sessionQuestionId === answer.sessionQuestionId);
    return {
      content: Number(answer.scoreSpecificity ?? detail?.scores.content ?? 0),
      logic: Number(answer.scoreLogic ?? detail?.scores.logic ?? 0),
      language: Number(answer.scoreLanguage ?? detail?.scores.language ?? 0),
      confidence: Number(answer.scoreRelevance ?? detail?.scores.confidence ?? 0),
      expertise: Number(answer.scoreRelevance ?? detail?.scores.expertise ?? 0),
      impression: Number(answer.scoreTotal ?? detail?.scores.total ?? 0),
    };
  }).filter((score) => score.impression > 0);

  const criteriaAverages = {
    content: average(scores.map((s) => s.content)),
    logic: average(scores.map((s) => s.logic)),
    language: average(scores.map((s) => s.language)),
    confidence: average(scores.map((s) => s.confidence)),
    expertise: average(scores.map((s) => s.expertise)),
    impression: average(scores.map((s) => s.impression)),
  };
  const overallScore = average(scores.map((s) => s.impression));
  const weakest = Object.entries(criteriaAverages).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "content";

  // --- Aggregate strengths/weaknesses from per-answer details ---
  const allStrengths = uniqueList(answerDetails.flatMap((d) => d.strengths));
  const allWeaknesses = uniqueList(answerDetails.flatMap((d) => d.weaknesses));

  return {
    criteriaAverages,
    improvementTips: uniqueList(
      answerDetails.flatMap((d) => d.tips).concat([
        "Luyện trả lời 60-90 giây/câu để đủ ý nhưng không lan man.",
        "Chuẩn bị 3 ví dụ cá nhân dùng được cho nhiều dạng câu hỏi.",
        "Ghi âm lại câu trả lời và sửa lỗi phát âm/ngữ pháp sau mỗi lượt luyện.",
      ])
    ).slice(0, 6),
    overallScore,
    progressHint: `Ưu tiên cải thiện tiêu chí ${translateCriterion(weakest)} trong buổi luyện tiếp theo.`,
    sessionSummary: buildSummary(session, overallScore, weakest),
    strengths: allStrengths.slice(0, 6),
    weaknesses: allWeaknesses.slice(0, 6),
    answerDetails,
  };
}

function buildSummary(session: InterviewSession, score: number, weakest: string) {
  const label = score >= 8 ? "tốt" : score >= 6.5 ? "khá" : "cần luyện thêm";
  return `Buổi phỏng vấn cho ${session.targetMajor ?? "ngành mục tiêu"} tại ${session.targetSchool ?? "trường mục tiêu"} đạt mức ${label}. Bạn đã trả lời ${session.answeredQuestions}/${session.totalQuestions} câu. Điểm cần tập trung là ${translateCriterion(weakest)}; hãy bổ sung ví dụ cá nhân, kế hoạch học tập rõ mốc và liên hệ với học bổng/trường.`;
}

function average(values: number[]) {
  const filtered = values.filter((v) => v > 0);
  if (!filtered.length) return 0;
  return Math.round((filtered.reduce((t, v) => t + v, 0) / filtered.length) * 10) / 10;
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values));
}

function compareWithSampleAnswer(answerText: string, sampleAnswer: string | null, keywordSource: string | null) {
  if (!sampleAnswer?.trim()) {
    return null;
  }

  const answerTokens = tokenize(answerText);
  const sampleTokens = tokenize(sampleAnswer);
  const keywordTokens = tokenize(keywordSource ?? "")
    .filter((token) => token.length >= 4)
    .slice(0, 12);
  const requiredTokens = Array.from(new Set(keywordTokens.length ? keywordTokens : sampleTokens.filter((token) => token.length >= 5))).slice(0, 12);
  const answerSet = new Set(answerTokens);
  const matchedKeywords = requiredTokens.filter((token) => answerSet.has(token));
  const missingKeywords = requiredTokens.filter((token) => !answerSet.has(token)).slice(0, 6);
  const coveragePercent = requiredTokens.length ? Math.round((matchedKeywords.length / requiredTokens.length) * 100) : 0;
  const lengthRatio = sampleTokens.length ? answerTokens.length / sampleTokens.length : 0;
  const notes: string[] = [];

  if (coveragePercent < 45) notes.push("Thieu nhieu y chinh so voi cau tra loi mau.");
  if (coveragePercent >= 45 && coveragePercent < 75) notes.push("Da cham mot phan y chinh, can bo sung cac keyword con thieu.");
  if (coveragePercent >= 75) notes.push("Bao phu tot cac y quan trong trong cau tra loi mau.");
  if (lengthRatio < 0.45) notes.push("Cau tra loi dang ngan hon nhieu so voi mau, nen them vi du va ke hoach cu the.");
  if (lengthRatio > 1.8) notes.push("Cau tra loi dai hon mau, nen rut gon y trung lap.");

  return {
    coveragePercent,
    matchedKeywords,
    missingKeywords,
    notes,
    sampleAnswer
  };
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function translateCriterion(value: string) {
  const map: Record<string, string> = {
    confidence: "tự tin",
    content: "nội dung",
    expertise: "chuyên ngành",
    impression: "ấn tượng",
    language: "ngôn ngữ",
    logic: "logic",
  };
  return map[value] ?? value;
}
