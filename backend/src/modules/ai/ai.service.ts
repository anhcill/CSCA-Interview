import { ai_task_type } from "@prisma/client";
import OpenAI from "openai";
import { env } from "../../config/env.js";
import { extractOpenAiTokenUsage, logAiUsage } from "./ai-usage.service.js";
import { promptTemplateNames, renderPromptTemplate, resolvePromptTemplate } from "./prompt-templates.js";

const deepseek = env.deepseekApiKey
  ? new OpenAI({
      apiKey: env.deepseekApiKey,
      baseURL: env.deepseekBaseUrl || "https://api.deepseek.com/v1"
    })
  : null;

const openai = deepseek || (env.openAiApiKey
  ? new OpenAI({
      apiKey: env.openAiApiKey,
      ...(env.openAiBaseUrl ? { baseURL: env.openAiBaseUrl } : {})
    })
  : null);

const activeProvider = env.deepseekApiKey ? "deepseek" : "openai";

export type InterviewQuestionInput = {
  degreeLevel: string;
  language?: "VI" | "ZH" | "EN";
  questionBankContext?: Array<{
    category?: string | null;
    commonMistakes?: string | null;
    expectedAnswerLogic?: string | null;
    keywords?: string | null;
    questionText: string;
    sampleAnswer?: string | null;
    scoringRubric?: unknown;
  }>;
  ragContext?: string | null;
  scholarshipType: string;
  studyPlan: string;
  targetMajor: string;
  targetSchool: string;
  userId?: string | null;
};

export type GeneratedInterviewQuestion = {
  aiReason: string;
  category: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  expectedAnswerLogic: string;
  questionText: string;
};

export type ConversationEntry = {
  questionText: string;
  answerText: string;
  category: string;
  score?: number | null;
};

export type FollowUpInput = {
  answerText: string;
  category: string;
  conversationHistory: ConversationEntry[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
  language: "VI" | "ZH" | "EN";
  ragContext?: string | null;
  targetMajor: string;
  targetSchool: string;
  scholarshipType: string;
  userId?: string | null;
};

export type AiScoreInput = {
  answerText: string;
  commonMistakes?: string | null;
  expectedAnswerLogic?: string | null;
  keywords?: string | null;
  language?: "VI" | "ZH" | "EN";
  questionText?: string | null;
  ragContext?: string | null;
  sampleAnswer?: string | null;
  scholarshipType?: string | null;
  scoringRubric?: unknown;
  targetMajor?: string | null;
  targetSchool?: string | null;
  userId?: string | null;
};

// ---------------------------------------------------------------------------
// System prompt: Chinese professor persona
// ---------------------------------------------------------------------------

export function buildSystemPrompt(input: {
  language: "VI" | "ZH" | "EN";
  targetSchool: string;
  targetMajor: string;
  scholarshipType: string;
  degreeLevel: string;
  ragContext?: string | null;
}): string {
  const base = [
    "You are Professor Wang (王教授), a scholarship interview examiner at a top Chinese university.",
    "You are friendly yet serious. You ask follow-up questions when answers lack depth.",
    "You NEVER repeat a question already asked in this session.",
    "You adjust difficulty based on the candidate's performance.",
    "",
    `Context: Candidate applies for ${input.scholarshipType} scholarship.`,
    `School: ${input.targetSchool}, Major: ${input.targetMajor}, Degree: ${input.degreeLevel}.`,
    input.ragContext ? `Database context:\n${input.ragContext}` : "",
    "",
    "Rules:",
    "- If score < 6.5 on last answer → ask easier, more guiding question.",
    "- If score >= 8 → ask harder, deeper question.",
    "- If candidate mentions a topic but lacks detail → follow up on that topic.",
    "- If candidate is weak on a category → ask more questions in that category.",
    "- Always vary question types: personal → academic → plan → motivation → situation.",
  ].join("\n");

  if (input.language === "ZH") {
    return base + "\n- Ask questions in Chinese (中文). Keep formal academic tone.";
  }
  if (input.language === "EN") {
    return base + "\n- Ask questions in English. Keep academic but approachable tone.";
  }
  return base + "\n- Ask questions in Vietnamese. Keep professional tone.";
}

const allowedCategories = [
  "PERSONAL",
  "STUDY_PLAN",
  "SCHOOL_MAJOR",
  "MOTIVATION",
  "CAREER_PLAN",
  "SCHOLARSHIP",
  "ACADEMIC",
  "RESEARCH",
  "SITUATION",
  "LANGUAGE",
  "OTHER"
] as const;

const allowedDifficulties = ["EASY", "MEDIUM", "HARD"] as const;

function parseJsonObject<T>(content: string): T | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const jsonText = fenced ?? trimmed;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    const first = jsonText.indexOf("{");
    const last = jsonText.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;

    try {
      return JSON.parse(jsonText.slice(first, last + 1)) as T;
    } catch {
      return null;
    }
  }
}

function safeCategory(value: unknown): string {
  const category = typeof value === "string" ? value.toUpperCase() : "";
  return allowedCategories.includes(category as (typeof allowedCategories)[number]) ? category : "STUDY_PLAN";
}

function safeDifficulty(value: unknown): "EASY" | "MEDIUM" | "HARD" {
  const difficulty = typeof value === "string" ? value.toUpperCase() : "";
  return allowedDifficulties.includes(difficulty as (typeof allowedDifficulties)[number])
    ? difficulty as "EASY" | "MEDIUM" | "HARD"
    : "MEDIUM";
}

function sanitizeQuestionText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 500) : "";
}

async function completeJson<T>(input: {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  operation: string;
  promptTemplateId?: string | null;
  requestPayload?: unknown;
  taskType: ai_task_type;
  temperature?: number;
  userId?: string | null;
}): Promise<T | null> {
  const startedAt = Date.now();
  if (!openai) {
    const latencyMs = Date.now() - startedAt;
    await logAiUsage({
      errorMessage: "OPENAI_API_KEY missing; deterministic fallback used",
      latencyMs,
      model: null,
      promptTemplateId: input.promptTemplateId ?? null,
      provider: "fallback",
      requestPayload: input.requestPayload ?? { messages: input.messages },
      taskType: input.taskType,
      userId: input.userId ?? null
    });
    console.warn(`[AI] ${input.operation} skipped: OPENAI_API_KEY missing; using deterministic fallback`);
    return null;
  }

  const isScoringOrAnalysis = input.taskType === ai_task_type.SCORE_ANSWER || input.taskType === ai_task_type.ANALYZE_STUDY_PLAN;
  const modelToUse = env.deepseekApiKey
    ? (isScoringOrAnalysis ? env.deepseekProModel : env.deepseekFlashModel)
    : env.openAiModel;

  try {
    const response = await openai.chat.completions.create({
      messages: input.messages,
      model: modelToUse,
      response_format: { type: "json_object" },
      temperature: input.temperature ?? 0.3
    });
    const latencyMs = Date.now() - startedAt;
    const rawContent = response.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject<T>(rawContent);

    await logAiUsage({
      latencyMs,
      model: modelToUse,
      promptTemplateId: input.promptTemplateId ?? null,
      provider: activeProvider,
      requestPayload: input.requestPayload ?? { messages: input.messages },
      responsePayload: {
        id: response.id,
        parsed,
        rawContent: parsed ? undefined : rawContent.slice(0, 2000)
      },
      taskType: input.taskType,
      tokenUsage: extractOpenAiTokenUsage(response.usage),
      userId: input.userId ?? null
    });

    console.log(`[AI] ${input.operation} ${activeProvider} ${latencyMs}ms model=${modelToUse}`);
    return parsed;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    await logAiUsage({
      errorMessage: error instanceof Error ? error.message : String(error),
      latencyMs,
      model: modelToUse,
      promptTemplateId: input.promptTemplateId ?? null,
      provider: activeProvider,
      requestPayload: input.requestPayload ?? { messages: input.messages },
      taskType: input.taskType,
      userId: input.userId ?? null
    });
    console.error(`[AI] ${input.operation} ${activeProvider} failed; using fallback`, error);
    return null;
  }
}

function languageInstruction(language: "VI" | "ZH" | "EN") {
  if (language === "ZH") return "Question language: Simplified Chinese. Feedback language: Vietnamese when explaining improvements to Vietnamese learner.";
  if (language === "EN") return "Question and answer language: English. Feedback language: English.";
  return "Question and answer language: Vietnamese. Feedback language: Vietnamese.";
}

// ---------------------------------------------------------------------------
// Category-specific prompt templates
// ---------------------------------------------------------------------------

type CategoryTemplate = {
  easy: string[];
  medium: string[];
  hard: string[];
};

const zhTemplates: Record<string, CategoryTemplate> = {
  PERSONAL: {
    easy: [
      "请简单介绍一下你自己。",
      "你的家人对你出国留学有什么看法？",
      "你平时有什么兴趣爱好？"
    ],
    medium: [
      "你认为自己最大的优势和不足是什么？",
      "你曾遇到过什么困难？你是如何克服的？",
      "你的成长经历中哪件事对你影响最大？"
    ],
    hard: [
      "请举一个你领导团队完成项目的经历，说明你发挥了什么作用。",
      "如果你的研究方向与导师的期望不一致，你会怎么处理？",
      "你认为自己与其他候选人相比，最大的竞争优势是什么？"
    ]
  },
  ACADEMIC: {
    easy: [
      "你最喜欢的一门课程是什么？为什么？",
      "你在大学期间学到了什么对你最有用的知识？",
      "你目前的专业背景是什么？"
    ],
    medium: [
      "你的毕业论文/课题研究方向是什么？",
      "你读过哪些与你专业相关的学术论文或书籍？",
      "你在学术上遇到过什么挑战？如何解决的？"
    ],
    hard: [
      "请结合一篇你读过的论文，说明它如何影响了你的研究方向。",
      "你如何看待你所在领域目前的研究前沿和发展趋势？",
      "如果你有机会做一个研究项目，你会选择什么课题？为什么？"
    ]
  },
  STUDY_PLAN: {
    easy: [
      "你未来的学习计划是什么？",
      "你来中国后第一年打算做什么？",
      "你对在中国的学习生活有什么期待？"
    ],
    medium: [
      "请按阶段说明你的学习计划（第一年、第二年等）。",
      "你打算如何提高你的中文水平？",
      "在学习期间，你计划参加什么课外活动或研究？"
    ],
    hard: [
      "你的学习计划如何与你的长期职业目标相结合？",
      "如果你的研究计划遇到瓶颈，你会如何调整方向？",
      "你计划发表论文吗？如果是，在哪些方向和期刊？"
    ]
  },
  MOTIVATION: {
    easy: [
      "你为什么想来中国留学？",
      "你对中国文化有什么了解？",
      "你为什么选择申请这个奖学金？"
    ],
    medium: [
      "除了这个奖学金，你还申请了其他学校或奖学金吗？",
      "你认为这个奖学金对你的职业发展有什么帮助？",
      "你对留学期间的困难有什么心理准备？"
    ],
    hard: [
      "如果没有获得奖学金，你还会来中国留学吗？为什么？",
      "你觉得你能为我们学校带来什么独特的贡献？",
      "你毕业后打算如何回报社会或推动你所在领域的发展？"
    ]
  },
  SCHOLARSHIP: {
    easy: [
      "你为什么申请这个奖学金？",
      "你了解这个奖学金的要求吗？",
      "获得奖学金对你意味着什么？"
    ],
    medium: [
      "你认为自己为什么值得获得这个奖学金？",
      "你如何证明你会充分利用奖学金提供的机会？",
      "如果你获得了奖学金，你会如何规划你的资金使用？"
    ],
    hard: [
      "请从你的学术背景和职业规划两方面说明你为什么是最合适的候选人。",
      "如果奖学金委员会对你的研究方向有不同意见，你会怎么处理？",
      "你认为奖学金应该优先给什么样的人？你如何符合这个标准？"
    ]
  },
  SCHOOL_MAJOR: {
    easy: [
      "你为什么选择我们学校？",
      "你了解我们的专业课程设置吗？",
      "你为什么选择这个专业？"
    ],
    medium: [
      "你了解我们学校在这个领域的研究优势吗？",
      "你选择这个专业和你之前的学习经历有什么关系？",
      "你对我们学校的哪位教授或研究团队最感兴趣？"
    ],
    hard: [
      "请分析我们学校这个专业与其他学校相比的优势和特色。",
      "你的研究方向如何与我们学校的学科建设目标相匹配？",
      "如果你发现实际课程与你的预期不同，你会怎么调整？"
    ]
  },
  CAREER_PLAN: {
    easy: [
      "毕业以后你有什么打算？",
      "你想从事什么样的工作？",
      "你的职业目标是什么？"
    ],
    medium: [
      "你的短期（3年内）和长期（10年内）职业目标分别是什么？",
      "你的专业学习如何帮助你实现职业目标？",
      "你毕业后打算回国还是留在中国发展？为什么？"
    ],
    hard: [
      "你如何将在中国学到的知识应用到你的国家或行业中？",
      "如果你的职业目标在毕业时发生了变化，你会如何应对？",
      "请描述一个你希望在职业生涯中解决的具体问题。"
    ]
  },
  SITUATION: {
    easy: [
      "如果你在中国遇到语言困难，你会怎么办？",
      "你有独自生活的经验吗？",
      "你如何适应新的文化环境？"
    ],
    medium: [
      "如果你和室友/同学发生冲突，你会怎么处理？",
      "如果你的论文导师给你的反馈与你的想法不同，你怎么办？",
      "描述一个你在压力下做出决定的经历。"
    ],
    hard: [
      "如果你的研究项目失败了，你会如何重新开始？",
      "如果你发现某个同学在学术上有不诚信行为，你会怎么做？",
      "请举例说明你在面对不确定性时如何做出判断。"
    ]
  }
};

const viTemplates: Record<string, CategoryTemplate> = {
  PERSONAL: {
    easy: ["Bạn hãy giới thiệu bản thân.", "Gia đình bạn nghĩ gì về việc du học?", "Sở thích của bạn là gì?"],
    medium: ["Điểm mạnh và điểm yếu lớn nhất của bạn?", "Bạn đã vượt qua khó khăn nào trong cuộc sống?", "Sự kiện nào ảnh hưởng lớn nhất đến bạn?"],
    hard: ["Kể về lần bạn dẫn dắt nhóm hoàn thành dự án.", "Nếu hướng nghiên cứu khác kỳ vọng giáo viên, bạn xử lý sao?", "Lợi thế cạnh tranh lớn nhất so với ứng viên khác?"]
  },
  STUDY_PLAN: {
    easy: ["Kế hoạch học tập của bạn là gì?", "Năm đầu ở Trung Quốc bạn dự định làm gì?", "Bạn kỳ vọng gì khi du học?"],
    medium: ["Trình bày kế hoạch theo từng giai đoạn.", "Bạn cải thiện tiếng Trung bằng cách nào?", "Hoạt động ngoại khóa/nghiên cứu bạn muốn tham gia?"],
    hard: ["Kế hoạch học tập kết hợp mục tiêu nghề nghiệp dài hạn thế nào?", "Nếu nghiên cứu gặp bế tắc, bạn điều chỉnh ra sao?", "Bạn có kế hoạch xuất bản bài báo không?"]
  },
  SCHOOL_MAJOR: {
    easy: ["Vì sao bạn chọn trường này?", "Bạn hiểu gì về chương trình học?", "Vì sao chọn ngành này?"],
    medium: ["Bạn biết gì về thế mạnh nghiên cứu của trường?", "Ngành này liên hệ gì với nền tảng học tập trước?", "Giáo sư/nhóm nghiên cứu nào bạn quan tâm?"],
    hard: ["Phân tích ưu thế ngành này ở trường so với nơi khác.", "Hướng nghiên cứu của bạn phù hợp thế nào với mục tiêu xây dựng ngành?", "Nếu chương trình khác kỳ vọng, bạn điều chỉnh sao?"]
  }
};

// ---------------------------------------------------------------------------
// Generate interview questions (initial set)
// ---------------------------------------------------------------------------

export async function generateInterviewQuestions(
  input: InterviewQuestionInput
): Promise<GeneratedInterviewQuestion[]> {
  const targetSchool = input.targetSchool || "trường bạn apply";
  const targetMajor = input.targetMajor || "ngành bạn apply";
  const scholarshipType = input.scholarshipType || "học bổng mục tiêu";
  const language = input.language ?? "ZH";

  {
    type QuestionPayload = {
      questions?: Array<Partial<GeneratedInterviewQuestion>>;
    };
    const promptTemplate = await resolvePromptTemplate(ai_task_type.GENERATE_QUESTIONS, promptTemplateNames.initialQuestions);
    const requestPayload = {
      degreeLevel: input.degreeLevel,
      language,
      languageInstruction: languageInstruction(language),
      questionBankContext: (input.questionBankContext ?? []).map((question) => ({
        category: question.category ?? null,
        commonMistakes: question.commonMistakes?.slice(0, 500) ?? null,
        expectedAnswerLogic: question.expectedAnswerLogic?.slice(0, 700) ?? null,
        keywords: question.keywords?.slice(0, 500) ?? null,
        questionText: question.questionText.slice(0, 500),
        sampleAnswer: question.sampleAnswer?.slice(0, 900) ?? null,
        scoringRubric: question.scoringRubric ?? null
      })),
      ragContext: input.ragContext?.slice(0, 6000) ?? null,
      scholarshipType,
      studyPlan: input.studyPlan?.slice(0, 1800) ?? "",
      targetMajor,
      targetSchool
    };

    const payload = await completeJson<QuestionPayload>({
      messages: [
        {
          role: "system",
          content: renderPromptTemplate(promptTemplate.systemPrompt, requestPayload)
        },
        {
          role: "user",
          content: renderPromptTemplate(promptTemplate.userPromptTemplate, requestPayload)
        }
      ],
      operation: "generateInterviewQuestions",
      promptTemplateId: promptTemplate.id,
      requestPayload,
      taskType: ai_task_type.GENERATE_QUESTIONS,
      temperature: 0.45,
      userId: input.userId ?? null
    });

    const questions = (payload?.questions ?? [])
      .map((question) => ({
        aiReason: typeof question.aiReason === "string" && question.aiReason.trim()
          ? question.aiReason.trim().slice(0, 300)
          : "Generated from candidate profile and study plan.",
        category: safeCategory(question.category),
        difficulty: safeDifficulty(question.difficulty),
        expectedAnswerLogic: typeof question.expectedAnswerLogic === "string" && question.expectedAnswerLogic.trim()
          ? question.expectedAnswerLogic.trim().slice(0, 600)
          : "Answer with a clear point, personal evidence, and a concrete plan.",
        questionText: sanitizeQuestionText(question.questionText)
      }))
      .filter((question) => question.questionText.length >= 8);

    if (questions.length >= 3) {
      return uniqueGeneratedQuestions(questions).slice(0, 5);
    }
  }

  if (input.language === "ZH") {
    return [
      buildGeneratedQuestion(`你为什么选择${targetSchool}的${targetMajor}专业？`, "SCHOOL_MAJOR"),
      buildGeneratedQuestion("你未来的学习计划是什么？", "STUDY_PLAN"),
      buildGeneratedQuestion(`你为什么认为${scholarshipType}奖学金适合你的目标？`, "SCHOLARSHIP")
    ];
  }

  if (input.language === "EN") {
    return [
      buildGeneratedQuestion(`Why did you choose ${targetMajor} at ${targetSchool}?`, "SCHOOL_MAJOR"),
      buildGeneratedQuestion("What is your study plan during your time in China?", "STUDY_PLAN"),
      buildGeneratedQuestion(`How does the ${scholarshipType} scholarship fit your academic goals?`, "SCHOLARSHIP")
    ];
  }

  return [
    buildGeneratedQuestion(`Vì sao bạn chọn ngành ${targetMajor} tại ${targetSchool}?`, "SCHOOL_MAJOR"),
    buildGeneratedQuestion("Kế hoạch học tập của bạn trong thời gian du học là gì?", "STUDY_PLAN"),
    buildGeneratedQuestion(`Học bổng ${scholarshipType} phù hợp với mục tiêu của bạn như thế nào?`, "SCHOLARSHIP")
  ];
}

function buildGeneratedQuestion(questionText: string, category: string): GeneratedInterviewQuestion {
  return {
    aiReason: "Fallback question generated without OpenAI key.",
    category,
    difficulty: "MEDIUM",
    expectedAnswerLogic: "Answer with a direct point, personal evidence, school/major fit, and a concrete next step.",
    questionText
  };
}

function uniqueGeneratedQuestions(questions: GeneratedInterviewQuestion[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = normalize(question.questionText);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Generate follow-up question based on conversation context
// ---------------------------------------------------------------------------

export function generateFollowUpQuestion(input: FollowUpInput): {
  questionText: string;
  aiReason: string;
  isFollowUp: boolean;
  followUpDepth: number;
} {
  const { answerText, category, conversationHistory, difficulty, language, targetMajor, targetSchool } = input;

  // Calculate follow-up depth (how many consecutive follow-ups on same topic)
  const followUpDepth = countConsecutiveFollowUps(conversationHistory, category);

  // If follow-up depth > 2, branch to different topic
  if (followUpDepth >= 2) {
    const newCategory = selectWeakestCategory(conversationHistory, category);
    return generateCategoryQuestion({
      category: newCategory,
      difficulty,
      language,
      targetMajor,
      targetSchool,
      reason: `Chuyển sang chủ đề ${newCategory} sau ${followUpDepth} câu đào sâu về ${category}.`,
      isFollowUp: false,
      followUpDepth: 0
    });
  }

  // Extract key point from answer for follow-up
  const keyPoint = extractAnswerKeyPoint(answerText, language);
  const askedTexts = new Set(conversationHistory.map((e) => normalize(e.questionText)));

  // Build follow-up based on answer content analysis
  const followUp = buildContextualFollowUp({
    answerText,
    category,
    difficulty,
    keyPoint,
    language,
    targetMajor,
    targetSchool
  });

  // Check if follow-up already asked
  if (askedTexts.has(normalize(followUp.questionText))) {
    return generateCategoryQuestion({
      category,
      difficulty,
      language,
      targetMajor,
      targetSchool,
      reason: "Follow-up trùng lặp, chọn câu hỏi mới từ template.",
      isFollowUp: false,
      followUpDepth
    });
  }

  return {
    ...followUp,
    isFollowUp: true,
    followUpDepth: followUpDepth + 1
  };
}

export async function generateAdaptiveFollowUpQuestion(input: FollowUpInput & {
  askedQuestions: string[];
}): Promise<{
  category?: string;
  questionText: string;
  aiReason: string;
  isFollowUp: boolean;
  followUpDepth: number;
} | null> {
  const followUpDepth = countConsecutiveFollowUps(input.conversationHistory, input.category);
  type FollowUpPayload = {
    aiReason?: string;
    category?: string;
    followUpDepth?: number;
    isFollowUp?: boolean;
    questionText?: string;
  };

  const promptTemplate = await resolvePromptTemplate(ai_task_type.GENERATE_QUESTIONS, promptTemplateNames.adaptiveFollowUp);
  const requestPayload = {
    answerText: input.answerText.slice(0, 1800),
    askedQuestions: input.askedQuestions.slice(-12),
    category: input.category,
    conversationHistory: input.conversationHistory.slice(-8),
    difficulty: input.difficulty,
    followUpDepth,
    languageInstruction: languageInstruction(input.language),
    ragContext: input.ragContext?.slice(0, 6000) ?? null,
    scholarshipType: input.scholarshipType,
    targetMajor: input.targetMajor,
    targetSchool: input.targetSchool
  };

  const payload = await completeJson<FollowUpPayload>({
    messages: [
      {
        role: "system",
        content: renderPromptTemplate(promptTemplate.systemPrompt, requestPayload)
      },
      {
        role: "user",
        content: renderPromptTemplate(promptTemplate.userPromptTemplate, requestPayload)
      }
    ],
    operation: "generateAdaptiveFollowUpQuestion",
    promptTemplateId: promptTemplate.id,
    requestPayload,
    taskType: ai_task_type.GENERATE_QUESTIONS,
    temperature: 0.35,
    userId: input.userId ?? null
  });

  const questionText = sanitizeQuestionText(payload?.questionText);
  if (!questionText) return null;

  const asked = new Set(input.askedQuestions.map(normalize));
  if (asked.has(normalize(questionText))) return null;

  return {
    aiReason: typeof payload?.aiReason === "string" && payload.aiReason.trim()
      ? payload.aiReason.trim().slice(0, 300)
      : "Adaptive OpenAI follow-up based on latest answer and session memory.",
    category: safeCategory(payload?.category),
    followUpDepth: typeof payload?.followUpDepth === "number" ? Math.max(0, Math.min(3, payload.followUpDepth)) : followUpDepth + 1,
    isFollowUp: payload?.isFollowUp ?? true,
    questionText
  };
}

function countConsecutiveFollowUps(history: ConversationEntry[], currentCategory: string): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].category === currentCategory) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function selectWeakestCategory(history: ConversationEntry[], excludeCategory: string): string {
  const categoryScores = new Map<string, number[]>();
  const allCategories = ["PERSONAL", "STUDY_PLAN", "SCHOOL_MAJOR", "MOTIVATION", "CAREER_PLAN", "SCHOLARSHIP", "ACADEMIC", "SITUATION"];

  for (const entry of history) {
    if (entry.score != null && entry.score > 0) {
      const scores = categoryScores.get(entry.category) ?? [];
      scores.push(entry.score);
      categoryScores.set(entry.category, scores);
    }
  }

  // Find categories not yet asked
  const askedCategories = new Set(history.map((e) => e.category));
  const unasked = allCategories.filter((c) => !askedCategories.has(c) && c !== excludeCategory);
  if (unasked.length > 0) {
    return unasked[Math.floor(Math.random() * unasked.length)];
  }

  // Find weakest category
  let weakest = excludeCategory === "STUDY_PLAN" ? "SCHOOL_MAJOR" : "STUDY_PLAN";
  let lowestAvg = 11;

  for (const [cat, scores] of categoryScores.entries()) {
    if (cat === excludeCategory) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < lowestAvg) {
      lowestAvg = avg;
      weakest = cat;
    }
  }

  return weakest;
}

function generateCategoryQuestion(input: {
  category: string;
  difficulty: string;
  language: string;
  targetMajor: string;
  targetSchool: string;
  reason: string;
  isFollowUp: boolean;
  followUpDepth: number;
}) {
  const templates = input.language === "ZH" ? zhTemplates : viTemplates;
  const categoryTemplates = templates[input.category] ?? templates["STUDY_PLAN"] ?? { easy: [], medium: [], hard: [] };
  const diffKey = input.difficulty === "HARD" ? "hard" : input.difficulty === "EASY" ? "easy" : "medium";
  const pool = categoryTemplates[diffKey] ?? categoryTemplates.medium ?? [];

  const questionText = pool.length > 0
    ? pool[Math.floor(Math.random() * pool.length)]
    : input.language === "ZH"
      ? `关于${input.category}，你还有什么想补充的？`
      : `Về chủ đề ${input.category}, bạn muốn bổ sung gì?`;

  return {
    aiReason: input.reason,
    followUpDepth: input.followUpDepth,
    isFollowUp: input.isFollowUp,
    questionText
  };
}

function buildContextualFollowUp(input: {
  answerText: string;
  category: string;
  difficulty: string;
  keyPoint: string;
  language: string;
  targetMajor: string;
  targetSchool: string;
}) {
  const { answerText, category, difficulty, keyPoint, language, targetMajor, targetSchool } = input;
  const lower = answerText.toLowerCase();

  // Detect what's missing in the answer
  const hasExample = /ví dụ|dự án|nghiên cứu|kinh nghiệm|thành tích|example|project|research|经验|项目|研究|成果/.test(lower);
  const hasPlan = /kế hoạch|mục tiêu|giai đoạn|sau khi|plan|goal|future|计划|目标|毕业|阶段/.test(lower);
  const isShort = answerText.length < 80;

  if (language === "ZH") {
    if (isShort) {
      return {
        questionText: `你刚才提到"${keyPoint}"，能不能再详细说说？`,
        aiReason: "回答较短，引导候选人展开更多细节。"
      };
    }
    if (!hasExample) {
      return {
        questionText: `关于"${keyPoint}"，你能举一个具体的经历或例子来说明吗？`,
        aiReason: "回答缺少具体案例，追问以获取个人经历。"
      };
    }
    if (!hasPlan && (category === "STUDY_PLAN" || category === "CAREER_PLAN")) {
      return {
        questionText: `你提到了"${keyPoint}"，那么你的具体计划分几个阶段？每个阶段的目标是什么？`,
        aiReason: "回答缺少阶段性计划，引导候选人补充。"
      };
    }
    if (difficulty === "HARD") {
      return {
        questionText: `你刚才说到"${keyPoint}"。如果遇到困难或失败，你会如何调整策略？`,
        aiReason: "高难度追问：考察应变能力和抗压能力。"
      };
    }
    return {
      questionText: `刚才你提到"${keyPoint}"，这和你选择${targetSchool}${targetMajor}专业有什么关系？`,
      aiReason: "引导候选人将回答与申请目标结合。"
    };
  }

  // Vietnamese / English fallback
  if (isShort) {
    return {
      questionText: language === "EN"
        ? `You mentioned "${keyPoint}". Could you elaborate on that?`
        : `Bạn vừa nhắc "${keyPoint}". Bạn có thể nói rõ hơn không?`,
      aiReason: "Câu trả lời ngắn, cần mở rộng chi tiết."
    };
  }
  if (!hasExample) {
    return {
      questionText: language === "EN"
        ? `Regarding "${keyPoint}", can you give a specific example from your experience?`
        : `Về "${keyPoint}", bạn có thể đưa một ví dụ cụ thể từ trải nghiệm không?`,
      aiReason: "Thiếu ví dụ cụ thể, đào sâu để lấy bằng chứng cá nhân."
    };
  }
  if (!hasPlan) {
    return {
      questionText: language === "EN"
        ? `You talked about "${keyPoint}". What are the specific stages of your plan?`
        : `Bạn nói về "${keyPoint}". Kế hoạch cụ thể theo từng giai đoạn là gì?`,
      aiReason: "Thiếu kế hoạch theo giai đoạn, hướng dẫn bổ sung."
    };
  }
  return {
    questionText: language === "EN"
      ? `How does "${keyPoint}" connect to your choice of ${targetMajor} at ${targetSchool}?`
      : `"${keyPoint}" liên hệ thế nào với việc chọn ngành ${targetMajor} tại ${targetSchool}?`,
    aiReason: "Liên kết câu trả lời với mục tiêu apply."
  };
}

function extractAnswerKeyPoint(answerText: string, language: string): string {
  const fallback = language === "ZH" ? "你的目标" : language === "EN" ? "your goal" : "mục tiêu của bạn";
  const cleaned = answerText.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;

  // Try to extract first meaningful phrase (first sentence or clause)
  const firstClause = cleaned.split(/[。.！!？?，,；;]/)[0]?.trim();
  if (firstClause && firstClause.length > 5 && firstClause.length <= 50) {
    return firstClause;
  }

  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}...` : cleaned;
}

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Detailed scoring (unchanged)
// ---------------------------------------------------------------------------

export type DetailedScore = {
  content: number;
  logic: number;
  language: number;
  confidence: number;
  expertise: number;
  impression: number;
  total: number;
  strengths: string[];
  weaknesses: string[];
  tips: string[];
  feedback: string;
  improvedAnswer: string;
  academicKeywords: string[];
};

export function scoreInterviewAnswer(answerText: string) {
  const detailed = scoreInterviewAnswerDetailed(answerText);

  return {
    feedback: detailed.feedback,
    improvedAnswer: detailed.improvedAnswer,
    score: detailed.total
  };
}

export function scoreInterviewAnswerDetailed(answerText: string): DetailedScore {
  const trimmed = answerText.trim();
  const lower = trimmed.toLowerCase();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  // --- Content detection ---
  const hasExample = /ví dụ|dự án|nghiên cứu|kinh nghiệm|thành tích|example|project|research|经验|项目|研究|成果|论文/.test(lower);
  const hasPlan = /kế hoạch|mục tiêu|giai đoạn|sau khi|plan|goal|future|计划|目标|毕业|阶段/.test(lower);
  const hasMajor = /ngành|trường|học bổng|chuyên ngành|university|major|scholarship|专业|大学|奖学金/.test(lower);
  const hasNumber = /\d/.test(trimmed);

  // --- Language analysis ---
  const langAnalysis = analyzeLanguage(trimmed);

  // --- Structure analysis ---
  const structureAnalysis = analyzeStructure(trimmed, wordCount);

  // --- Base score from length ---
  const lengthBase = wordCount < 12 ? 4.8 : wordCount < 30 ? 6.2 : wordCount < 60 ? 7.5 : 8.2;
  const detailBonus = (hasExample ? 0.6 : 0) + (hasPlan ? 0.5 : 0) + (hasMajor ? 0.5 : 0) + (hasNumber ? 0.3 : 0);

  // --- 6 criteria scoring ---
  const content = clampScore(lengthBase + detailBonus);
  const logic = clampScore(lengthBase + (hasPlan ? 0.7 : -0.3) + structureAnalysis.logicBonus);
  const language = clampScore(lengthBase + langAnalysis.grammarBonus + langAnalysis.vocabBonus);
  const confidence = clampScore(wordCount < 12 ? 5 : wordCount < 30 ? 6.5 : wordCount < 60 ? 7.5 : 8.2);
  const expertise = clampScore(lengthBase + (hasMajor ? 0.9 : -0.6) + (langAnalysis.academicVocabCount > 2 ? 0.5 : 0));
  const impression = clampScore(lengthBase + (hasExample ? 0.9 : -0.4) + structureAnalysis.impressionBonus);

  // --- Weighted total (content 25%, logic 20%, language 20%, confidence 10%, expertise 15%, impression 10%) ---
  const total = round1(content * 0.25 + logic * 0.2 + language * 0.2 + confidence * 0.1 + expertise * 0.15 + impression * 0.1);

  // --- Strengths (pick top 3 relevant) ---
  const strengthPool: string[] = [];
  if (content >= 7) strengthPool.push("Trả lời đúng trọng tâm câu hỏi, đủ nội dung.");
  if (logic >= 7) strengthPool.push("Lập luận mạch lạc, có hướng rõ ràng.");
  if (language >= 7) strengthPool.push("Ngôn ngữ phù hợp, ít lỗi ngữ pháp.");
  if (hasMajor) strengthPool.push("Biết liên hệ với trường/ngành/học bổng mục tiêu.");
  if (hasExample) strengthPool.push("Có dẫn chứng cá nhân tăng tính thuyết phục.");
  if (hasPlan) strengthPool.push("Có kế hoạch/mục tiêu cụ thể.");
  if (hasNumber) strengthPool.push("Sử dụng dữ liệu/con số cụ thể.");
  if (langAnalysis.academicVocabCount > 2) strengthPool.push("Sử dụng từ vựng học thuật phù hợp.");
  if (structureAnalysis.hasClearOpening) strengthPool.push("Mở đầu rõ ràng, dễ theo dõi.");
  if (strengthPool.length < 3) strengthPool.push("Đã có ý chính ban đầu để phát triển.");
  const strengths = strengthPool.slice(0, 3);

  // --- Weaknesses (pick top 3 relevant) ---
  const weakPool: string[] = [];
  if (wordCount < 45) weakPool.push("Câu trả lời còn ngắn, thiếu chi tiết.");
  if (!hasExample) weakPool.push("Thiếu dẫn chứng/ví dụ cá nhân.");
  if (!hasPlan) weakPool.push("Chưa nêu kế hoạch theo giai đoạn rõ ràng.");
  if (langAnalysis.grammarIssues.length > 0) weakPool.push(`Ngữ pháp cần chú ý: ${langAnalysis.grammarIssues[0]}`);
  if (!hasMajor) weakPool.push("Chưa liên hệ rõ với ngành/trường apply.");
  if (structureAnalysis.isTooLong) weakPool.push("Câu trả lời dài, có thể rút gọn bớt.");
  if (langAnalysis.academicVocabCount === 0) weakPool.push("Chưa sử dụng từ vựng học thuật phù hợp.");
  if (!structureAnalysis.hasClearOpening) weakPool.push("Thiếu câu mở đầu/kết luận rõ ràng.");
  if (weakPool.length < 3) weakPool.push("Dẫn chứng nên kết nối mạnh hơn với mục tiêu.");
  const weaknesses = weakPool.slice(0, 3);

  // --- Tips ---
  const tips = [
    "Dùng cấu trúc 3 phần: ý chính → ví dụ cá nhân → liên hệ trường/ngành/học bổng.",
    ...langAnalysis.suggestedKeywords.length > 0
      ? [`Thử dùng từ khóa học thuật: ${langAnalysis.suggestedKeywords.slice(0, 4).join(", ")}.`]
      : ["Thêm từ vựng chuyên ngành để thể hiện hiểu biết."],
    structureAnalysis.structureTip,
    "Kết thúc bằng mục tiêu cụ thể sau khi tốt nghiệp."
  ].slice(0, 4);

  return {
    academicKeywords: langAnalysis.suggestedKeywords.length > 0
      ? langAnalysis.suggestedKeywords
      : ["study plan", "research direction", "academic fit", "career goal", "scholarship motivation"],
    confidence,
    content,
    expertise,
    feedback: total >= 8
      ? "Câu trả lời có cấu trúc tốt, đủ ý và có khả năng tạo ấn tượng. Hãy luyện nói ngắn gọn hơn để tự nhiên trong phỏng vấn thật."
      : total >= 6.5
        ? "Câu trả lời đúng hướng nhưng cần thêm ví dụ, mốc kế hoạch và liên hệ rõ hơn với ngành/trường."
        : "Câu trả lời còn mỏng. Bạn cần bổ sung lý do cụ thể, dẫn chứng cá nhân và mục tiêu sau tốt nghiệp.",
    impression,
    improvedAnswer: buildImprovedAnswer(trimmed, langAnalysis, structureAnalysis),
    language,
    logic,
    strengths,
    tips,
    total,
    weaknesses
  };
}

export async function scoreInterviewAnswerWithAi(input: AiScoreInput): Promise<DetailedScore> {
  const fallback = scoreInterviewAnswerDetailed(input.answerText);

  type ScorePayload = Partial<DetailedScore>;
  const language = input.language ?? "VI";
  const promptTemplate = await resolvePromptTemplate(ai_task_type.SCORE_ANSWER, promptTemplateNames.scoreAnswer);
  const requestPayload = {
    answerText: input.answerText.slice(0, 5000),
    commonMistakes: input.commonMistakes ?? null,
    expectedAnswerLogic: input.expectedAnswerLogic ?? null,
    fallbackHeuristicScore: fallback,
    keywords: input.keywords ?? null,
    language,
    languageInstruction: languageInstruction(language),
    questionText: input.questionText ?? null,
    ragContext: input.ragContext?.slice(0, 6000) ?? null,
    sampleAnswer: input.sampleAnswer ?? null,
    scholarshipType: input.scholarshipType ?? null,
    scoringRubric: input.scoringRubric ?? null,
    targetMajor: input.targetMajor ?? null,
    targetSchool: input.targetSchool ?? null
  };
  const payload = await completeJson<ScorePayload>({
    messages: [
      {
        role: "system",
        content: renderPromptTemplate(promptTemplate.systemPrompt, requestPayload)
      },
      {
        role: "user",
        content: renderPromptTemplate(promptTemplate.userPromptTemplate, requestPayload)
      }
    ],
    operation: "scoreInterviewAnswer",
    promptTemplateId: promptTemplate.id,
    requestPayload,
    taskType: ai_task_type.SCORE_ANSWER,
    temperature: 0.15,
    userId: input.userId ?? null
  });

  if (!payload || typeof payload.feedback !== "string" || typeof payload.improvedAnswer !== "string") {
    return fallback;
  }

  const content = normalizeScore(payload.content, fallback.content);
  const logic = normalizeScore(payload.logic, fallback.logic);
  const languageScore = normalizeScore(payload.language, fallback.language);
  const confidence = normalizeScore(payload.confidence, fallback.confidence);
  const expertise = normalizeScore(payload.expertise, fallback.expertise);
  const impression = normalizeScore(payload.impression, fallback.impression);
  const total = normalizeScore(
    payload.total,
    round1(content * 0.25 + logic * 0.2 + languageScore * 0.2 + confidence * 0.1 + expertise * 0.15 + impression * 0.1)
  );

  return {
    academicKeywords: normalizeStringArray(payload.academicKeywords, fallback.academicKeywords).slice(0, 8),
    confidence,
    content,
    expertise,
    feedback: payload.feedback.trim().slice(0, 1200),
    improvedAnswer: payload.improvedAnswer.trim().slice(0, 2000),
    impression,
    language: languageScore,
    logic,
    strengths: normalizeStringArray(payload.strengths, fallback.strengths).slice(0, 4),
    tips: normalizeStringArray(payload.tips, fallback.tips).slice(0, 5),
    total,
    weaknesses: normalizeStringArray(payload.weaknesses, fallback.weaknesses).slice(0, 4)
  };
}

function normalizeScore(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? clampScore(numberValue) : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

function clampScore(value: number) {
  return round1(Math.max(0, Math.min(10, value)));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Language analysis — grammar, academic vocab, structure
// ---------------------------------------------------------------------------

type LanguageAnalysis = {
  grammarBonus: number;
  grammarIssues: string[];
  vocabBonus: number;
  academicVocabCount: number;
  suggestedKeywords: string[];
};

const academicVocabZh = [
  "研究", "论文", "课题", "方向", "领域", "理论", "实践", "方法", "分析",
  "创新", "贡献", "学术", "专业", "导师", "实验", "数据", "文献", "综述",
  "硕士", "博士", "本科", "毕业", "学位", "课程", "选修", "必修"
];

const academicVocabVi = [
  "nghiên cứu", "luận văn", "đề tài", "phương pháp", "lý thuyết", "thực tiễn",
  "phân tích", "đóng góp", "học thuật", "chuyên ngành", "giáo sư", "thí nghiệm",
  "dữ liệu", "tài liệu", "tổng quan", "thạc sĩ", "tiến sĩ", "cử nhân",
  "tốt nghiệp", "học phần", "kỹ năng", "năng lực"
];

const academicVocabEn = [
  "research", "thesis", "dissertation", "methodology", "theory", "practice",
  "analysis", "contribution", "academic", "professor", "experiment", "data",
  "literature", "review", "bachelor", "master", "doctoral", "curriculum",
  "competence", "expertise", "innovation", "publication"
];

function analyzeLanguage(text: string): LanguageAnalysis {
  const lower = text.toLowerCase();
  const grammarIssues: string[] = [];

  // Detect language
  const isChinese = /[\u4e00-\u9fff]/.test(text);
  const isEnglish = /^[a-zA-Z\s.,!?'"()-]+$/.test(text.replace(/\d/g, ""));

  let academicPool: string[];
  let suggestPool: string[];

  if (isChinese) {
    academicPool = academicVocabZh;
    suggestPool = ["学术背景", "研究方向", "职业规划", "学习计划", "跨文化交流"];

    // Chinese grammar checks
    if (text.length > 10 && !/[。！？]/.test(text)) grammarIssues.push("Câu tiếng Trung thiếu dấu kết thúc (。！？).");
    if (/的的/.test(text)) grammarIssues.push('Lặp "的的" — thừa trợ từ.');
    if (text.split("，").length > 8) grammarIssues.push("Câu quá dài, nên tách thành nhiều câu ngắn hơn.");
  } else if (isEnglish) {
    academicPool = academicVocabEn;
    suggestPool = ["academic background", "research interest", "career plan", "study plan", "cross-cultural"];

    // English grammar checks
    if (/\bi\b/.test(text) && !/\bI\b/.test(text)) grammarIssues.push('"i" nên viết hoa thành "I".');
    if (/\s{2,}/.test(text)) grammarIssues.push("Có khoảng trắng thừa giữa các từ.");
    if (text.length > 20 && !/[.!?]$/.test(text.trim())) grammarIssues.push("Câu chưa có dấu kết thúc.");
  } else {
    academicPool = academicVocabVi;
    suggestPool = ["nền tảng học thuật", "hướng nghiên cứu", "định hướng nghề nghiệp", "kế hoạch học tập", "giao lưu văn hóa"];

    // Vietnamese grammar checks
    if (text.length > 20 && !/[.!?]$/.test(text.trim())) grammarIssues.push("Câu chưa có dấu kết thúc.");
    if (/\s{2,}/.test(text)) grammarIssues.push("Có khoảng trắng thừa.");
  }

  const foundAcademic = academicPool.filter((word) => lower.includes(word.toLowerCase()));
  const academicVocabCount = foundAcademic.length;

  // Suggest keywords not yet used
  const suggestedKeywords = suggestPool.filter((kw) => !lower.includes(kw.toLowerCase()));

  const grammarBonus = grammarIssues.length === 0 ? 0.3 : grammarIssues.length === 1 ? 0 : -0.3;
  const vocabBonus = academicVocabCount >= 4 ? 0.5 : academicVocabCount >= 2 ? 0.2 : -0.2;

  return { academicVocabCount, grammarBonus, grammarIssues, suggestedKeywords, vocabBonus };
}

// ---------------------------------------------------------------------------
// Structure analysis — opening, length, logic flow
// ---------------------------------------------------------------------------

type StructureAnalysis = {
  hasClearOpening: boolean;
  isTooLong: boolean;
  logicBonus: number;
  impressionBonus: number;
  structureTip: string;
};

function analyzeStructure(text: string, wordCount: number): StructureAnalysis {
  const lower = text.toLowerCase();
  const sentences = text.split(/[。.！!？?]/).filter((s) => s.trim().length > 3);

  // Check clear opening
  const openingPatterns = /^(tôi|em|mình|i |my |我|首先|trước hết|thưa|kính|xin|hello|dear)/i;
  const hasClearOpening = openingPatterns.test(text.trim());

  // Check if too long (> 200 words rambling)
  const isTooLong = wordCount > 200;

  // Logic flow: connectors present?
  const connectors = /vì vậy|do đó|ngoài ra|thêm vào đó|bên cạnh|therefore|moreover|furthermore|in addition|因此|此外|另外|而且|首先|其次|最后|第一|第二/i;
  const hasConnectors = connectors.test(lower);

  // Conclusion pattern
  const hasConclusion = /tóm lại|kết luận|cuối cùng|in conclusion|to sum up|总之|综上|最后/i.test(lower);

  const logicBonus = (hasConnectors ? 0.4 : 0) + (hasConclusion ? 0.3 : 0) + (sentences.length >= 3 ? 0.2 : -0.2);
  const impressionBonus = (hasClearOpening ? 0.3 : 0) + (hasConclusion ? 0.3 : 0);

  let structureTip: string;
  if (!hasClearOpening && !hasConclusion) {
    structureTip = "Thêm câu mở đầu giới thiệu ý chính và câu kết tóm tắt.";
  } else if (!hasConnectors) {
    structureTip = "Dùng từ nối (vì vậy, ngoài ra, 因此, 此外) để logic mạch lạc hơn.";
  } else if (isTooLong) {
    structureTip = "Rút gọn câu trả lời, tập trung 60-90 giây khi nói.";
  } else {
    structureTip = "Cấu trúc ổn, thử thêm 1 điểm nhấn ấn tượng ở cuối.";
  }

  return { hasClearOpening, impressionBonus, isTooLong, logicBonus, structureTip };
}

// ---------------------------------------------------------------------------
// Build improved answer suggestion
// ---------------------------------------------------------------------------

function buildImprovedAnswer(
  originalText: string,
  langAnalysis: LanguageAnalysis,
  structureAnalysis: StructureAnalysis
): string {
  const parts: string[] = [];

  if (!structureAnalysis.hasClearOpening) {
    parts.push("Mở đầu: Giới thiệu ngắn gọn ý chính câu trả lời.");
  }

  parts.push(
    "Thân bài: Nêu lý do cụ thể + ví dụ cá nhân (dự án, trải nghiệm, con số). Liên hệ với ngành/trường/học bổng."
  );

  if (langAnalysis.suggestedKeywords.length > 0) {
    parts.push(`Thử dùng từ khóa: ${langAnalysis.suggestedKeywords.slice(0, 3).join(", ")}.`);
  }

  parts.push(
    "Kết luận: Tóm tắt mục tiêu sau tốt nghiệp và cam kết đóng góp."
  );

  return parts.join("\n");
}

export type StudyPlanAnalysisInput = {
  studyPlan: string;
  degreeLevel: string;
  targetSchool: string;
  targetMajor: string;
  scholarshipType: string;
  ragContext?: string | null;
  userId?: string | null;
};

export type StudyPlanAnalysisAiResult = {
  strengths: string[];
  weaknesses: string[];
  missingPoints: string[];
  suggestions: string[];
  alignmentScore: number;
  generatedQuestions: string[];
};

export async function analyzeStudyPlanWithAi(
  input: StudyPlanAnalysisInput
): Promise<StudyPlanAnalysisAiResult> {
  const targetSchool = input.targetSchool || "trường bạn apply";
  const targetMajor = input.targetMajor || "ngành bạn apply";
  const scholarshipType = input.scholarshipType || "học bổng mục tiêu";
  const degreeLevel = input.degreeLevel || "BACHELOR";

  if (openai) {
    const requestPayload = {
      studyPlan: input.studyPlan,
      degreeLevel,
      targetSchool,
      targetMajor,
      scholarshipType,
      ragContext: input.ragContext?.slice(0, 6000) ?? null
    };

    const payload = await completeJson<StudyPlanAnalysisAiResult>({
      messages: [
        {
          role: "system",
          content: [
            "You are Professor Wang (王教授), an expert academic evaluator analyzing a student's Study Plan for scholarship application in China.",
            `School: ${targetSchool}, Major: ${targetMajor}, Degree: ${degreeLevel}, Scholarship: ${scholarshipType}.`,
            input.ragContext ? `Database context/requirements:\n${input.ragContext}` : "",
            "",
            "Rules:",
            "- Analyze the study plan's content, logic, and grammar.",
            "- Determine a quantitative alignment score (0 to 100) based on how well it fits the targeted school/major requirements.",
            "- Extract strengths (what is good), weaknesses (what is poor), missing points (what is required but omitted), and suggestions (actionable tips for improvement).",
            "- Generate 3-5 specific, high-fidelity interview questions that a professor might ask based on this study plan.",
            "- Feedback and output MUST be in Vietnamese.",
            "- Return strict JSON matching the schema below.",
            "",
            "Schema:",
            "{",
            '  "strengths": ["điểm mạnh 1", "điểm mạnh 2"],',
            '  "weaknesses": ["điểm yếu 1", "điểm yếu 2"],',
            '  "missingPoints": ["điểm thiếu 1", "điểm thiếu 2"],',
            '  "suggestions": ["gợi ý 1", "gợi ý 2"],',
            '  "alignmentScore": 85,',
            '  "generatedQuestions": ["câu hỏi 1", "câu hỏi 2"]',
            "}"
          ].join("\n")
        },
        {
          role: "user",
          content: `Hãy phân tích kế hoạch học tập dưới đây:\n\n${input.studyPlan}`
        }
      ],
      operation: "analyzeStudyPlan",
      promptTemplateId: null,
      requestPayload,
      taskType: ai_task_type.ANALYZE_STUDY_PLAN,
      temperature: 0.3,
      userId: input.userId ?? null
    });

    if (payload) {
      return {
        strengths: Array.isArray(payload.strengths) ? payload.strengths.map(String) : [],
        weaknesses: Array.isArray(payload.weaknesses) ? payload.weaknesses.map(String) : [],
        missingPoints: Array.isArray(payload.missingPoints) ? payload.missingPoints.map(String) : [],
        suggestions: Array.isArray(payload.suggestions) ? payload.suggestions.map(String) : [],
        alignmentScore: typeof payload.alignmentScore === "number" ? Math.min(100, Math.max(0, payload.alignmentScore)) : 70,
        generatedQuestions: Array.isArray(payload.generatedQuestions) ? payload.generatedQuestions.map(String) : []
      };
    }
  }

  // Fallback
  return {
    strengths: ["Kế hoạch học tập có cấu trúc rõ ràng.", "Thể hiện động lực học tập tốt."],
    weaknesses: ["Các mục tiêu nghiên cứu còn hơi chung chung.", "Chưa nêu rõ vì sao chọn trường này."],
    missingPoints: ["Thiếu chi tiết về kế hoạch nghiên cứu cụ thể.", "Thiếu thông tin kết nối giữa quá khứ và tương lai."],
    suggestions: ["Cần mô tả chi tiết hơn về đề tài/hướng nghiên cứu mong muốn.", "Nên tìm hiểu kỹ hơn về thế mạnh giảng dạy của trường apply."],
    alignmentScore: 70,
    generatedQuestions: [
      `Kế hoạch cụ thể của bạn để hoàn thành mục tiêu nghiên cứu tại ${targetSchool} là gì?`,
      `Tại sao bạn lại chọn ngành ${targetMajor} mà không phải ngành khác?`,
      `Học bổng ${scholarshipType} sẽ giúp ích gì cho định hướng nghề nghiệp tương lai của bạn?`
    ]
  };
}
