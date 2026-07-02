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
  speech: {
    confidenceScore: number | null;
    fillerWordTotal: number | null;
    fluencyScore: number | null;
    pauseCount: number | null;
    pronunciationScore: number | null;
    tips: string[];
    wpm: number | null;
  } | null;
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
  speechSummary: string | null;
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
  voice_recordings?: Array<{
    feedback: string | null;
    fluency_score: unknown;
    pronunciation_score: unknown;
    speed_words_per_minute: unknown;
  }>;
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
      const speech = buildSpeechDetail(answer);
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
        tips: uniqueList(detailed.tips.concat(speech?.tips ?? [])),
        feedback: detailed.feedback,
        improvedAnswer: detailed.improvedAnswer,
        academicKeywords: detailed.academicKeywords,
        speech,
        sampleComparison,
      };
    });

  // --- Criteria averages from DB scores (fallback to detailed) ---
  const scores = answers.map((answer) => {
    const detail = answerDetails.find((d) => d.sessionQuestionId === answer.sessionQuestionId);
    const voiceConfidence = scaleSpeechScore(detail?.speech?.confidenceScore ?? detail?.speech?.fluencyScore ?? null);
    const voiceLanguage = scaleSpeechScore(detail?.speech?.pronunciationScore ?? null);
    const textConfidence = Number(answer.scoreRelevance ?? detail?.scores.confidence ?? 0);
    const textLanguage = Number(answer.scoreLanguage ?? detail?.scores.language ?? 0);
    return {
      content: Number(answer.scoreSpecificity ?? detail?.scores.content ?? 0),
      logic: Number(answer.scoreLogic ?? detail?.scores.logic ?? 0),
      language: average([textLanguage, voiceLanguage ?? 0]),
      confidence: average([textConfidence, voiceConfidence ?? 0]),
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
  const speechTips = uniqueList(answerDetails.flatMap((d) => d.speech?.tips ?? []));
  const speechSummary = buildSpeechSummary(answerDetails);

  return {
    criteriaAverages,
    improvementTips: uniqueList(
      answerDetails.flatMap((d) => d.tips).concat(speechTips, [
        "Luyện trả lời 60-90 giây/câu để đủ ý nhưng không lan man.",
        "Chuẩn bị 3 ví dụ cá nhân dùng được cho nhiều dạng câu hỏi.",
        "Ghi âm lại câu trả lời và sửa lỗi phát âm/ngữ pháp sau mỗi lượt luyện.",
      ])
    ).slice(0, 6),
    overallScore,
    progressHint: `Ưu tiên cải thiện tiêu chí ${translateCriterion(weakest)} trong buổi luyện tiếp theo.`,
    speechSummary,
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

function buildSpeechDetail(answer: AnswerWithQuestion): AnswerDetailedAnalysis["speech"] {
  const recording = answer.voice_recordings?.[0];
  if (!recording) return null;

  const feedback = parseVoiceFeedback(recording.feedback);
  const metrics = getObject(feedback, "speechMetrics");
  const pronunciation = getObject(feedback, "pronunciation");
  const fluencyScore = toNumber(recording.fluency_score) ?? getNumber(metrics, "fluencyScore") ?? getNumber(pronunciation, "fluencyScore");
  const pronunciationScore = toNumber(recording.pronunciation_score) ?? getNumber(pronunciation, "pronunciationScore");
  const confidenceScore = getNumber(metrics, "confidenceScore");
  const pauseCount = getNumber(metrics, "pauseCount");
  const fillerWordTotal = getNumber(metrics, "fillerWordTotal");
  const wpm = toNumber(recording.speed_words_per_minute) ?? getNumber(metrics, "wpm");
  const tips = buildSpeechTips({
    confidenceScore,
    fillerWordTotal,
    fluencyScore,
    pauseCount,
    pronunciationScore,
    wpm
  });

  return {
    confidenceScore,
    fillerWordTotal,
    fluencyScore,
    pauseCount,
    pronunciationScore,
    tips,
    wpm
  };
}

function buildSpeechTips(input: {
  confidenceScore: number | null;
  fillerWordTotal: number | null;
  fluencyScore: number | null;
  pauseCount: number | null;
  pronunciationScore: number | null;
  wpm: number | null;
}) {
  const tips: string[] = [];
  if (input.wpm !== null && input.wpm < 80) tips.push("Tăng tốc độ nói một chút, tránh ngắt quá lâu giữa các ý.");
  if (input.wpm !== null && input.wpm > 180) tips.push("Nói chậm lại để phát âm rõ và giúp hội đồng theo kịp ý.");
  if (input.pauseCount !== null && input.pauseCount > 3) tips.push("Giảm số lần ngắt nghỉ dài bằng cách chuẩn bị dàn ý 3 điểm trước khi nói.");
  if (input.fillerWordTotal !== null && input.fillerWordTotal > 4) tips.push("Giảm từ đệm như uh, um, ờ; thay bằng khoảng dừng ngắn có kiểm soát.");
  if (input.fluencyScore !== null && input.fluencyScore < 65) tips.push("Luyện nói liền mạch 60 giây/câu, ưu tiên câu ngắn và rõ chủ vị.");
  if (input.pronunciationScore !== null && input.pronunciationScore < 70) tips.push("Luyện lại các từ chuyên ngành và ghi âm so sánh với giọng mẫu.");
  if (!tips.length && (input.fluencyScore !== null || input.pronunciationScore !== null)) {
    tips.push("Giữ nhịp nói hiện tại, tập thêm ví dụ cụ thể để phần trả lời thuyết phục hơn.");
  }
  return tips;
}

function buildSpeechSummary(answerDetails: AnswerDetailedAnalysis[]) {
  const speechDetails = answerDetails.map((detail) => detail.speech).filter((detail): detail is NonNullable<AnswerDetailedAnalysis["speech"]> => Boolean(detail));
  if (!speechDetails.length) return null;

  const fluency = average(speechDetails.map((detail) => detail.fluencyScore ?? 0));
  const pronunciation = average(speechDetails.map((detail) => detail.pronunciationScore ?? 0));
  const confidence = average(speechDetails.map((detail) => detail.confidenceScore ?? detail.fluencyScore ?? 0));
  const wpm = average(speechDetails.map((detail) => detail.wpm ?? 0));
  const parts = [
    fluency ? `độ trôi chảy ${fluency}/100` : null,
    pronunciation ? `phát âm ${pronunciation}/100` : null,
    confidence ? `tự tin giọng nói ${confidence}/100` : null,
    wpm ? `tốc độ trung bình ${wpm} WPM` : null
  ].filter(Boolean);

  return parts.length ? `Phân tích giọng nói: ${parts.join(", ")}.` : null;
}

function parseVoiceFeedback(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getObject(source: unknown, key: string) {
  if (!source || typeof source !== "object") return null;
  const value = (source as Record<string, unknown>)[key];
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function getNumber(source: Record<string, unknown> | null, key: string) {
  if (!source) return null;
  return toNumber(source[key]);
}

function toNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number(value ?? NaN);
  return Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : null;
}

function scaleSpeechScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return value > 10 ? Math.round((value / 10) * 10) / 10 : value;
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
