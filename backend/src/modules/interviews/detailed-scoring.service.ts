import { InterviewAnswer, InterviewSession, InterviewSessionQuestion, Question } from "@prisma/client";
import { scoreInterviewAnswerDetailed, type DetailedScore } from "../ai/ai.service.js";
import { buildEvidenceFeedback, containsAudioOnlyFeedback } from "./text-feedback-guard.js";
import { getInterviewPhase } from "./interview-structure.js";
import { isQuestionLanguageCompatible } from "./question-quality.js";
import { buildSevenDayPracticePlan, type PracticePlanDay } from "./practice-plan.js";

export type AnswerDetailedAnalysis = {
  sessionQuestionId: string;
  questionText: string;
  answerText: string;
  answerSource: "MIC" | "TEXT";
  transcript: string | null;
  audioScore: number | null;
  achievedIdeas: string[];
  missingIdeas: string[];
  suggestedFollowUpQuestion: string;
  phaseKey: string;
  phaseLabel: string;
  depthReached: number;
  scoringSource: "ai" | "heuristic";
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
  completedTopics: Array<{
    averageScore: number;
    depthReached: number;
    key: string;
    label: string;
    questionCount: number;
  }>;
  depthReached: number;
  criticalErrors: string[];
  languageErrors: Array<{ message: string; sessionQuestionId: string }>;
  offFocusAnswers: Array<{ questionText: string; reason: string; sessionQuestionId: string }>;
  practicePlan7Days: PracticePlanDay[];
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
    transcript?: string | null;
  }>;
};

export function buildSessionAnalysis(
  session: InterviewSession & { answers: AnswerWithQuestion[] }
): SessionAnalysis {
  const answers = session.answers;
  const phaseDepthCounts = new Map<string, number>();

  // --- Per-answer detailed analysis ---
  const answerDetails: AnswerDetailedAnalysis[] = answers
    .filter((a) => a.answerText && a.answerText.trim().length > 0)
    .map((answer) => {
      const phase = getInterviewPhase(answer.sessionQuestion.category);
      const depthReached = Math.min(3, (phaseDepthCounts.get(phase.key) ?? 0) + 1);
      phaseDepthCounts.set(phase.key, depthReached);
      const sampleComparison = compareWithSampleAnswer(
        answer.answerText ?? "",
        answer.sessionQuestion?.question?.sampleAnswer ?? null,
        answer.sessionQuestion?.question?.keywords ?? answer.sessionQuestion?.question?.suggestedAnswerLogic ?? null
      );
      const speech = buildSpeechDetail(answer);
      const recording = answer.voice_recordings?.[0];
      const transcript = recording?.transcript?.trim() || null;
      const answerSource = recording ? "MIC" as const : "TEXT" as const;
      const audioScore = speech
        ? average([speech.fluencyScore ?? 0, speech.pronunciationScore ?? 0, speech.confidenceScore ?? 0])
        : null;
      const achievedIdeas = (sampleComparison?.matchedKeywords.length
        ? sampleComparison.matchedKeywords
        : splitStoredLines(answer.strengths)).slice(0, 5);
      const missingIdeas = (sampleComparison?.missingKeywords.length
        ? sampleComparison.missingKeywords
        : splitStoredLines(answer.weaknesses)).slice(0, 5);
      const reportFields = {
        achievedIdeas,
        answerSource,
        audioScore,
        depthReached,
        missingIdeas,
        phaseKey: phase.key,
        phaseLabel: phase.label,
        suggestedFollowUpQuestion: buildSuggestedFollowUp(answer.sessionQuestion.language, missingIdeas[0]),
        transcript
      };
      const persistedTotal = toNumber(answer.scoreTotal);

      if (persistedTotal !== null && persistedTotal > 0) {
        const content = toNumber(answer.scoreSpecificity) ?? persistedTotal;
        const logic = toNumber(answer.scoreLogic) ?? persistedTotal;
        const textLanguage = toNumber(answer.scoreLanguage) ?? persistedTotal;
        const expertise = toNumber(answer.scoreRelevance) ?? persistedTotal;
        const storedFeedback = answer.feedback?.trim() || "AI scored this answer, but detailed feedback was not stored.";
        const feedback = !speech && containsAudioOnlyFeedback(storedFeedback)
          ? buildEvidenceFeedback(answer.answerText ?? "", answer.sessionQuestion.language)
          : storedFeedback;
        const strengths = splitStoredLines(answer.strengths)
          .filter((item) => speech || !containsAudioOnlyFeedback(item));
        const weaknesses = splitStoredLines(answer.weaknesses)
          .filter((item) => speech || !containsAudioOnlyFeedback(item));

        return {
          ...reportFields,
          sessionQuestionId: answer.sessionQuestionId,
          questionText: answer.sessionQuestion?.questionText ?? "",
          answerText: answer.answerText ?? "",
          scoringSource: "ai" as const,
          scores: {
            content,
            logic,
            language: textLanguage,
            confidence: expertise,
            expertise,
            impression: persistedTotal,
            total: persistedTotal,
          },
          strengths,
          weaknesses,
          tips: uniqueList((speech?.tips ?? []).concat(sampleComparison?.notes ?? [])),
          feedback,
          improvedAnswer: answer.improvedAnswer?.trim() ?? "",
          academicKeywords: extractAcademicKeywords(
            answer.sessionQuestion?.question?.keywords ?? answer.sessionQuestion?.question?.suggestedAnswerLogic ?? ""
          ),
          speech,
          sampleComparison,
        };
      }

      const detailed: DetailedScore = scoreInterviewAnswerDetailed(answer.answerText ?? "");
      return {
        ...reportFields,
        sessionQuestionId: answer.sessionQuestionId,
        questionText: answer.sessionQuestion?.questionText ?? "",
        answerText: answer.answerText ?? "",
        scoringSource: "heuristic" as const,
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

  // Official aggregates only use persisted AI scores. Heuristic details remain visible as fallback guidance.
  const scores = answerDetails
    .filter((detail) => detail.scoringSource === "ai")
    .map((detail) => detail.scores)
    .filter((score) => score.total > 0);

  const criteriaAverages = {
    content: average(scores.map((s) => s.content)),
    logic: average(scores.map((s) => s.logic)),
    language: average(scores.map((s) => s.language)),
    confidence: average(scores.map((s) => s.confidence)),
    expertise: average(scores.map((s) => s.expertise)),
    impression: average(scores.map((s) => s.impression)),
  };
  const overallScore = average(scores.map((s) => s.impression));
  const weakest = scores.length
    ? Object.entries(criteriaAverages).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "content"
    : "content";

  // --- Aggregate strengths/weaknesses from per-answer details ---
  const allStrengths = uniqueList(answerDetails.flatMap((d) => d.strengths));
  const allWeaknesses = uniqueList(answerDetails.flatMap((d) => d.weaknesses));
  const speechTips = uniqueList(answerDetails.flatMap((d) => d.speech?.tips ?? []));
  const speechSummary = buildSpeechSummary(answerDetails);
  const completedTopics = buildCompletedTopics(answerDetails);
  const depthReached = answerDetails.length
    ? Math.max(...answerDetails.map((detail) => detail.depthReached))
    : 0;
  const criticalErrors = uniqueList(allWeaknesses.concat(answerDetails.flatMap((detail) => detail.missingIdeas))).slice(0, 3);
  const languageErrors = answerDetails
    .filter((detail) => {
      const answer = answers.find((item) => item.sessionQuestionId === detail.sessionQuestionId);
      return answer ? !isQuestionLanguageCompatible(detail.answerText, answer.sessionQuestion.language) : false;
    })
    .map((detail) => ({
      message: "Câu trả lời không nhất quán với ngôn ngữ đã chọn cho buổi phỏng vấn.",
      sessionQuestionId: detail.sessionQuestionId
    }));
  const offFocusAnswers = answerDetails
    .filter((detail) => detail.scores.content > 0 && (detail.scores.content < 5.5 || detail.scores.expertise < 5.5))
    .map((detail) => ({
      questionText: detail.questionText,
      reason: "Nội dung hoặc mức độ liên hệ chuyên ngành còn thấp.",
      sessionQuestionId: detail.sessionQuestionId
    }));
  const practicePlan7Days = buildSevenDayPracticePlan({
    hasSpeech: answerDetails.some((detail) => detail.speech !== null),
    targetMajor: session.targetMajor,
    weaknesses: criticalErrors,
    weakestCriterion: translateCriterion(weakest)
  });

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
    progressHint: scores.length
      ? `Ưu tiên cải thiện tiêu chí ${translateCriterion(weakest)} trong buổi luyện tiếp theo.`
      : "Chưa có điểm AI chính thức, hãy hoàn tất cấu hình AI hoặc chấm lại khi model khả dụng.",
    speechSummary,
    sessionSummary: buildSummary(session, overallScore, weakest, scores.length > 0),
    strengths: allStrengths.slice(0, 6),
    weaknesses: allWeaknesses.slice(0, 6),
    answerDetails,
    completedTopics,
    criticalErrors,
    depthReached,
    languageErrors,
    offFocusAnswers,
    practicePlan7Days
  };
}

function buildCompletedTopics(details: AnswerDetailedAnalysis[]): SessionAnalysis["completedTopics"] {
  const grouped = new Map<string, AnswerDetailedAnalysis[]>();
  for (const detail of details) {
    grouped.set(detail.phaseKey, [...(grouped.get(detail.phaseKey) ?? []), detail]);
  }
  return [...grouped.entries()].map(([key, items]) => ({
    averageScore: average(items.map((item) => item.scores.total)),
    depthReached: Math.max(...items.map((item) => item.depthReached)),
    key,
    label: items[0]?.phaseLabel ?? key,
    questionCount: items.length
  }));
}

function buildSuggestedFollowUp(language: string, missingIdea?: string) {
  const focus = missingIdea?.trim();
  if (language === "ZH") {
    return focus
      ? `你可以围绕“${focus}”补充一个具体例子和可验证的结果吗？`
      : "你能进一步说明这个选择与申请目标之间的联系，并给出具体例子吗？";
  }
  if (language === "EN") {
    return focus
      ? `Could you add a concrete example and a verifiable outcome for "${focus}"?`
      : "Could you explain this point more deeply with a concrete example and its connection to your application goal?";
  }
  return focus
    ? `Bạn có thể bổ sung một ví dụ cụ thể và kết quả kiểm chứng được cho ý “${focus}” không?`
    : "Bạn có thể đào sâu ý này bằng một ví dụ cụ thể và liên hệ với mục tiêu ứng tuyển không?";
}

function buildSummary(session: InterviewSession, score: number, weakest: string, hasOfficialScore = true) {
  if (!hasOfficialScore) {
    return `Buổi phỏng vấn cho ${session.targetMajor ?? "ngành mục tiêu"} tại ${session.targetSchool ?? "trường mục tiêu"} đã được lưu, nhưng chưa có điểm AI chính thức. Hãy kiểm tra cấu hình model/API rồi chấm lại để nhận báo cáo chuẩn.`;
  }

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
  if (
    fluencyScore === null
    && pronunciationScore === null
    && confidenceScore === null
    && pauseCount === null
    && fillerWordTotal === null
    && wpm === null
  ) {
    return null;
  }
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

function average(values: number[]) {
  const filtered = values.filter((v) => v > 0);
  if (!filtered.length) return 0;
  return Math.round((filtered.reduce((t, v) => t + v, 0) / filtered.length) * 10) / 10;
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.filter((value) => !isLegacyGenericTip(value))));
}

function isLegacyGenericTip(value: string) {
  return value.includes("60-90")
    || value.includes("3 ví")
    || value.includes("Ghi âm");
}

function splitStoredLines(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractAcademicKeywords(value: string | null | undefined) {
  return uniqueList(
    tokenize(value ?? "")
      .filter((token) => token.length >= 4)
      .slice(0, 8)
  );
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

  if (coveragePercent < 45) notes.push("Thiếu nhiều ý chính so với câu trả lời mẫu.");
  if (coveragePercent >= 45 && coveragePercent < 75) notes.push("Đã bao quát một phần ý chính, cần bổ sung các từ khóa còn thiếu.");
  if (coveragePercent >= 75) notes.push("Bao phủ tốt các ý quan trọng trong câu trả lời mẫu.");
  if (lengthRatio < 0.45) notes.push("Câu trả lời đang ngắn hơn nhiều so với mẫu, nên thêm ví dụ và kế hoạch cụ thể.");
  if (lengthRatio > 1.8) notes.push("Câu trả lời dài hơn mẫu, nên rút gọn ý trùng lặp.");

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
