import { DifficultyLevel, LanguageCode, QuestionCategory, QuestionSource, type InterviewAnswer, type InterviewSession, type InterviewSessionQuestion } from "@prisma/client";
import { generateAdaptiveFollowUpQuestion, generateFollowUpQuestion, type ConversationEntry } from "../ai/ai.service.js";
import { buildInterviewRagContext } from "./rag-context.service.js";
import { analyzeInterviewDepth, extractCandidateClaims } from "./interview-depth.js";
import {
  buildPhaseFallbackQuestion,
  interviewPhases,
  selectNextInterviewPhase,
  type InterviewPhaseKey
} from "./interview-structure.js";
import { validateInterviewQuestion } from "./question-quality.js";

type SessionWithContext = InterviewSession & {
  answers: InterviewAnswer[];
  profile?: { studyPlan: string | null } | null;
  sessionQuestions: InterviewSessionQuestion[];
};

export type AdaptiveQuestion = {
  aiReason: string;
  category: QuestionCategory;
  completedPhases: InterviewPhaseKey[];
  difficulty: DifficultyLevel;
  expectedAnswerLogic: string;
  isFollowUp: boolean;
  followUpDepth: number;
  language: LanguageCode;
  phaseDepth: number;
  phaseKey: InterviewPhaseKey;
  phaseLabel: string;
  phaseTargetMinutes: number;
  questionsPerPhase: Record<InterviewPhaseKey, number>;
  questionText: string;
  source: QuestionSource;
};

const categoryByWeakText: Array<{ category: QuestionCategory; keywords: string[] }> = [
  { category: QuestionCategory.STUDY_PLAN, keywords: ["plan", "study", "kế hoạch", "学习", "计划"] },
  { category: QuestionCategory.RESEARCH, keywords: ["research", "paper", "nghiên cứu", "论文", "研究"] },
  { category: QuestionCategory.SCHOOL_MAJOR, keywords: ["school", "major", "trường", "ngành", "学校", "专业"] },
  { category: QuestionCategory.SCHOLARSHIP, keywords: ["scholarship", "học bổng", "奖学金"] },
  { category: QuestionCategory.CAREER_PLAN, keywords: ["career", "job", "nghề", "职业"] },
  { category: QuestionCategory.PERSONAL, keywords: ["myself", "introduce", "bản thân", "giới thiệu", "自我", "介绍"] },
  { category: QuestionCategory.OTHER, keywords: ["why", "motivation", "vì sao", "động lực", "为什么", "原因"] },
  { category: QuestionCategory.SITUATION, keywords: ["difficulty", "challenge", "khó khăn", "困难", "挑战"] },
  { category: QuestionCategory.LANGUAGE, keywords: ["language", "chinese", "tiếng", "ngôn ngữ", "语言", "中文"] }
];

// ---------------------------------------------------------------------------
// Build conversation history from session data
// ---------------------------------------------------------------------------

export function buildConversationHistory(session: SessionWithContext): ConversationEntry[] {
  const questionMap = new Map<string, InterviewSessionQuestion>();
  for (const q of session.sessionQuestions) {
    questionMap.set(q.id, q);
  }

  const sortedAnswers = [...session.answers].sort(
    (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime()
  );

  return sortedAnswers.map((answer) => {
    const question = questionMap.get(answer.sessionQuestionId);
    return {
      answerText: answer.answerText ?? "",
      category: question?.category ?? "STUDY_PLAN",
      questionText: question?.questionText ?? "",
      score: answer.scoreTotal ? Number(answer.scoreTotal) : null
    };
  });
}

// ---------------------------------------------------------------------------
// Main entry: create adaptive question with conversation memory
// ---------------------------------------------------------------------------

export async function createAdaptiveQuestion(session: SessionWithContext): Promise<AdaptiveQuestion> {
  const conversationHistory = buildConversationHistory(session);
  const lastAnswer = [...session.answers].sort((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime())[0];

  const avgScore = getAverageScore(session.answers);
  const difficulty = pickDifficulty(avgScore);
  const phase = selectNextInterviewPhase(session.sessionQuestions, session.answers);
  const category = phase.category;
  const depthAnalysis = analyzeInterviewDepth({
    answerText: lastAnswer?.answerText ?? "",
    requestedDepth: phase.depth
  });
  const elapsedMinutes = session.startedAt
    ? Math.max(0, (Date.now() - session.startedAt.getTime()) / 60_000)
    : 0;
  const remainingMinutes = Math.max(0, (session.plannedDurationMinutes ?? 30) - elapsedMinutes);
  const requiredTopicsRemaining = interviewPhases
    .filter((item) => !phase.completedPhases.includes(item.key))
    .map((item) => item.label);
  const askedTexts = new Set(session.sessionQuestions.map((q) => normalize(q.questionText)));
  const ragContext = await buildInterviewRagContext({
    majorId: session.majorId,
    schoolId: session.schoolId,
    scholarshipId: session.scholarshipId,
    scholarshipType: session.scholarshipType,
    targetMajor: session.targetMajor,
    targetSchool: session.targetSchool
  });

  const followUpInput = {
    answerText: lastAnswer?.answerText ?? "",
    candidateClaims: conversationHistory
      .flatMap((entry) => extractCandidateClaims(entry.answerText))
      .slice(-8),
    category: category as string,
    conversationHistory,
    currentDepth: depthAnalysis.currentDepth,
    currentTopic: phase.label,
    depthStrategy: depthAnalysis.strategy,
    difficulty: difficulty as "EASY" | "MEDIUM" | "HARD",
    language: session.language as "VI" | "ZH" | "EN",
    missingContent: depthAnalysis.missingContent,
    ragContext: ragContext.contextText,
    remainingMinutes: Math.round(remainingMinutes * 10) / 10,
    requiredTopicsRemaining,
    scholarshipType: session.scholarshipType ?? "học bổng mục tiêu",
    targetMajor: session.targetMajor ?? "ngành bạn apply",
    targetSchool: session.targetSchool ?? "trường bạn apply",
    studyPlan: session.profile?.studyPlan ?? null,
    userId: session.userId
  };

  const askedQuestions = session.sessionQuestions.map((question) => question.questionText);
  let aiFollowUpResult = await generateAdaptiveFollowUpQuestion({
    ...followUpInput,
    askedQuestions
  });

  let validation = aiFollowUpResult ? validateInterviewQuestion({
    askedQuestions,
    language: session.language,
    questionText: aiFollowUpResult.questionText,
    ragContext: ragContext.contextText,
    targetMajor: session.targetMajor
  }) : null;

  if (aiFollowUpResult && validation && !validation.valid) {
    aiFollowUpResult = await generateAdaptiveFollowUpQuestion({
      ...followUpInput,
      askedQuestions,
      retryInstruction: `Regenerate and fix: ${validation.reasons.join(", ")}`
    });
    validation = aiFollowUpResult ? validateInterviewQuestion({
      askedQuestions,
      language: session.language,
      questionText: aiFollowUpResult.questionText,
      ragContext: ragContext.contextText,
      targetMajor: session.targetMajor
    }) : null;
  }

  const deterministicFollowUp = generateFollowUpQuestion(followUpInput);
  const followUpResult = aiFollowUpResult && validation?.valid
    ? aiFollowUpResult
    : deterministicFollowUp;
  let questionText = followUpResult.questionText;

  if (!aiFollowUpResult || !validation?.valid) {
    const deterministicValidation = validateInterviewQuestion({
      askedQuestions,
      language: session.language,
      questionText: deterministicFollowUp.questionText,
      ragContext: ragContext.contextText,
      targetMajor: session.targetMajor
    });
    const safeFallback = buildPhaseFallbackQuestion({
      answerText: lastAnswer?.answerText,
      language: session.language,
      phase: phase.key,
      targetMajor: session.targetMajor,
      targetSchool: session.targetSchool
    });
    questionText = deterministicValidation.valid
      ? deterministicFollowUp.questionText
      : safeFallback;
  }
  if (askedTexts.has(normalize(questionText))) {
    const candidates = buildFallbackCandidates({
      answerText: lastAnswer?.answerText ?? "",
      category,
      difficulty,
      language: session.language,
      targetMajor: session.targetMajor ?? "ngành bạn apply",
      targetSchool: session.targetSchool ?? "trường bạn apply"
    });
    questionText = candidates.find((c) => !askedTexts.has(normalize(c))) ?? candidates[0];
  }

  const resolvedCategory = category;

  return {
    aiReason: followUpResult.aiReason,
    category: resolvedCategory,
    completedPhases: phase.completedPhases,
    difficulty,
    expectedAnswerLogic: buildExpectedLogic(resolvedCategory, difficulty, session.language),
    followUpDepth: followUpResult.followUpDepth,
    isFollowUp: followUpResult.isFollowUp,
    language: session.language,
    phaseDepth: phase.depth,
    phaseKey: phase.key,
    phaseLabel: phase.label,
    phaseTargetMinutes: phase.targetMinutes,
    questionsPerPhase: phase.questionsPerPhase,
    questionText,
    source: QuestionSource.AI_GENERATED
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAverageScore(answers: InterviewAnswer[]) {
  const scores = answers.map((a) => Number(a.scoreTotal ?? 0)).filter((s) => s > 0);
  if (!scores.length) return null;
  return scores.reduce((t, s) => t + s, 0) / scores.length;
}

function pickDifficulty(avgScore: number | null) {
  if (avgScore === null) return DifficultyLevel.MEDIUM;
  if (avgScore < 6.5) return DifficultyLevel.EASY;
  if (avgScore >= 8) return DifficultyLevel.HARD;
  return DifficultyLevel.MEDIUM;
}

function pickCategory(
  previousCategory: QuestionCategory | undefined,
  answerText: string,
  history: ConversationEntry[]
): QuestionCategory {
  const lower = answerText.toLowerCase();
  const matched = categoryByWeakText.find((item) =>
    item.keywords.some((kw) => lower.includes(kw.toLowerCase()))
  );

  if (matched) return matched.category;

  // If last 2 questions same category, try to switch
  if (history.length >= 2) {
    const lastTwo = history.slice(-2);
    if (lastTwo[0].category === lastTwo[1].category && lastTwo[0].category === previousCategory) {
      // Find weakest or unasked category
      const askedCats = new Set(history.map((e) => e.category));
      const allCats: QuestionCategory[] = [
        QuestionCategory.PERSONAL, QuestionCategory.STUDY_PLAN,
        QuestionCategory.SCHOOL_MAJOR, QuestionCategory.OTHER,
        QuestionCategory.CAREER_PLAN, QuestionCategory.SCHOLARSHIP,
        QuestionCategory.SITUATION, QuestionCategory.LANGUAGE
      ];
      const unasked = allCats.filter((c) => !askedCats.has(c));
      if (unasked.length > 0) {
        return unasked[Math.floor(Math.random() * unasked.length)];
      }
    }
  }

  return previousCategory ?? QuestionCategory.STUDY_PLAN;
}

function detectCategory(questionText: string, fallback: QuestionCategory): QuestionCategory {
  const lower = questionText.toLowerCase();
  for (const item of categoryByWeakText) {
    if (item.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return item.category;
    }
  }
  return fallback;
}

function mapToQuestionCategory(category: QuestionCategory | string): QuestionCategory {
  const map: Record<string, QuestionCategory> = {
    PERSONAL: QuestionCategory.PERSONAL,
    ACADEMIC: QuestionCategory.RESEARCH,
    STUDY_PLAN: QuestionCategory.STUDY_PLAN,
    MOTIVATION: QuestionCategory.OTHER,
    SCHOLARSHIP: QuestionCategory.SCHOLARSHIP,
    SCHOOL_MAJOR: QuestionCategory.SCHOOL_MAJOR,
    CAREER_PLAN: QuestionCategory.CAREER_PLAN,
    SITUATION: QuestionCategory.SITUATION,
    LANGUAGE: QuestionCategory.LANGUAGE,
    RESEARCH: QuestionCategory.RESEARCH
  };
  return map[category as string] ?? QuestionCategory.STUDY_PLAN;
}

function buildFallbackCandidates(input: {
  answerText: string;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  language: LanguageCode;
  targetMajor: string;
  targetSchool: string;
}) {
  const keyPoint = extractKeyPoint(input.answerText, input.language);

  if (input.language === LanguageCode.ZH) {
    return [
      `刚才你提到"${keyPoint}"，你能举一个具体例子说明吗？`,
      `如果你进入${input.targetSchool}学习${input.targetMajor}，第一学期你会优先解决什么问题？`,
      input.difficulty === DifficultyLevel.HARD
        ? `请结合一个你读过的论文、项目或课程，说明它如何支持你的研究方向。`
        : `你还需要补充哪些准备，才能更好地适应这个专业？`,
      `关于你刚才说的，你能从另一个角度再说说吗？`,
      `你觉得你目前的准备足够吗？还有什么不足？`
    ];
  }

  if (input.language === LanguageCode.EN) {
    return [
      `You mentioned "${keyPoint}". Can you give one concrete example?`,
      `If you study ${input.targetMajor} at ${input.targetSchool}, what would you prioritize in your first semester?`,
      input.difficulty === DifficultyLevel.HARD
        ? "Please connect one paper, project, or course you know with your future research direction."
        : "What preparation do you still need for this major?",
      "Can you look at this from a different perspective?",
      "Do you feel your current preparation is sufficient? What gaps remain?"
    ];
  }

  return [
    `Bạn vừa nhắc tới "${keyPoint}". Bạn có thể đưa một ví dụ cụ thể không?`,
    `Nếu học ngành ${input.targetMajor} tại ${input.targetSchool}, học kỳ đầu bạn sẽ ưu tiên việc gì?`,
    input.difficulty === DifficultyLevel.HARD
      ? "Hãy liên hệ một paper, dự án hoặc môn học bạn biết với định hướng nghiên cứu sắp tới."
      : "Bạn cần chuẩn bị thêm gì để theo tốt ngành này?",
    "Bạn có thể nhìn nhận vấn đề từ góc độ khác không?",
    "Bạn thấy mình đã chuẩn bị đủ chưa? Còn thiếu gì?"
  ];
}

function extractKeyPoint(answerText: string, language: LanguageCode) {
  const fallback = language === LanguageCode.ZH ? "你的目标" : language === LanguageCode.EN ? "your goal" : "mục tiêu của bạn";
  const cleaned = answerText.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;

  const firstClause = cleaned.split(/[。.！!？?，,；;]/)[0]?.trim();
  if (firstClause && firstClause.length > 5 && firstClause.length <= 50) {
    return firstClause;
  }

  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}...` : cleaned;
}

function buildExpectedLogic(category: QuestionCategory, difficulty: DifficultyLevel, language: LanguageCode) {
  if (language === LanguageCode.ZH) {
    return `回答要包含具体例子、个人经历、与${category}相关的计划；难度：${difficulty}。`;
  }
  if (language === LanguageCode.EN) {
    return `Answer with a concrete example, personal evidence, and a plan related to ${category}; difficulty: ${difficulty}.`;
  }
  return `Trả lời bằng ví dụ cụ thể, bằng chứng cá nhân và kế hoạch liên quan ${category}; độ khó: ${difficulty}.`;
}

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}
