import { LanguageCode, QuestionCategory } from "@prisma/client";

export type InterviewPhaseKey =
  | "INTRODUCTION"
  | "ACADEMIC"
  | "SCHOOL_MAJOR"
  | "MAJOR_EXPERTISE"
  | "STUDY_PLAN"
  | "SCHOLARSHIP_CAREER"
  | "SITUATION";

export type InterviewPhaseDefinition = {
  categories: QuestionCategory[];
  key: InterviewPhaseKey;
  label: string;
  targetMinutes: number;
};

export const interviewPhases: InterviewPhaseDefinition[] = [
  { categories: [QuestionCategory.PERSONAL], key: "INTRODUCTION", label: "Giới thiệu bản thân", targetMinutes: 5 },
  { categories: [QuestionCategory.ACADEMIC], key: "ACADEMIC", label: "Thành tích học tập", targetMinutes: 3 },
  { categories: [QuestionCategory.SCHOOL_MAJOR], key: "SCHOOL_MAJOR", label: "Trường và ngành học", targetMinutes: 4 },
  { categories: [QuestionCategory.RESEARCH], key: "MAJOR_EXPERTISE", label: "Kiến thức chuyên ngành", targetMinutes: 6 },
  { categories: [QuestionCategory.STUDY_PLAN], key: "STUDY_PLAN", label: "Kế hoạch học tập/nghiên cứu", targetMinutes: 5 },
  {
    categories: [QuestionCategory.SCHOLARSHIP, QuestionCategory.CAREER_PLAN],
    key: "SCHOLARSHIP_CAREER",
    label: "Học bổng và nghề nghiệp",
    targetMinutes: 4
  },
  { categories: [QuestionCategory.SITUATION], key: "SITUATION", label: "Phản biện và tình huống", targetMinutes: 3 }
];

const deepeningOrder: InterviewPhaseKey[] = [
  "MAJOR_EXPERTISE",
  "STUDY_PLAN",
  "SCHOOL_MAJOR",
  "ACADEMIC",
  "SCHOLARSHIP_CAREER",
  "SITUATION"
];

export type InterviewStructureQuestion = {
  category: QuestionCategory;
  id: string;
  orderIndex: number;
};

export type InterviewStructureAnswer = {
  sessionQuestionId: string;
};

export type InterviewPhaseDecision = {
  category: QuestionCategory;
  completedPhases: InterviewPhaseKey[];
  depth: number;
  key: InterviewPhaseKey;
  label: string;
  questionsPerPhase: Record<InterviewPhaseKey, number>;
  targetMinutes: number;
};

export function getInterviewQuestionLimit(plannedDurationMinutes?: number | null) {
  const minutes = Number(plannedDurationMinutes ?? 30);
  if (!Number.isFinite(minutes) || minutes <= 0) return 7;
  if (minutes <= 15) return 4;
  if (minutes <= 30) return 7;
  return Math.min(30, Math.max(7, Math.round(minutes / 5)));
}

export function getInterviewPhase(category: QuestionCategory) {
  return interviewPhases.find((phase) => phase.categories.includes(category))
    ?? interviewPhases.find((phase) => phase.key === "STUDY_PLAN")!;
}

export function selectNextInterviewPhase(
  questions: InterviewStructureQuestion[],
  answers: InterviewStructureAnswer[]
): InterviewPhaseDecision {
  const answeredIds = new Set(answers.map((answer) => answer.sessionQuestionId));
  const answeredQuestions = [...questions]
    .filter((question) => answeredIds.has(question.id))
    .sort((left, right) => left.orderIndex - right.orderIndex);
  const questionsPerPhase = emptyPhaseCounts();

  for (const question of answeredQuestions) {
    questionsPerPhase[getInterviewPhase(question.category).key] += 1;
  }

  const completedPhases = interviewPhases
    .filter((phase) => questionsPerPhase[phase.key] > 0)
    .map((phase) => phase.key);
  const firstUncovered = interviewPhases.find((phase) => questionsPerPhase[phase.key] === 0);
  const selectedKey = firstUncovered?.key
    ?? [...deepeningOrder].sort((left, right) => questionsPerPhase[left] - questionsPerPhase[right])[0]
    ?? "MAJOR_EXPERTISE";
  const phase = interviewPhases.find((item) => item.key === selectedKey)!;

  return {
    category: categoryForPhase(phase, questionsPerPhase[phase.key]),
    completedPhases,
    depth: questionsPerPhase[phase.key] + 1,
    key: phase.key,
    label: phase.label,
    questionsPerPhase,
    targetMinutes: phase.targetMinutes
  };
}

export function buildPhaseFallbackQuestion(input: {
  answerText?: string | null;
  language: LanguageCode;
  phase: InterviewPhaseKey;
  targetMajor?: string | null;
  targetSchool?: string | null;
}) {
  const major = localizedTarget(
    input.targetMajor,
    input.language,
    localized(input.language, "ngành bạn đăng ký", "your chosen major", "你申请的专业")
  );
  const school = localizedTarget(
    input.targetSchool,
    input.language,
    localized(input.language, "trường bạn đăng ký", "your chosen university", "你申请的学校")
  );

  const questions: Record<InterviewPhaseKey, [string, string, string]> = {
    INTRODUCTION: [
      "Bạn có 5 phút để giới thiệu bản thân, gồm nền tảng học tập, kinh nghiệm liên quan, điểm mạnh và mục tiêu ứng tuyển.",
      "Please use five minutes to introduce yourself, including your academic background, relevant experience, strengths, and application goal.",
      "请用五分钟介绍你自己，包括学习背景、相关经历、个人优势和申请目标。"
    ],
    ACADEMIC: [
      "Từ phần giới thiệu vừa rồi, thành tích học tập nào thể hiện rõ nhất năng lực của bạn? Hãy nêu minh chứng cụ thể.",
      "From your introduction, which academic achievement best demonstrates your ability? Please give concrete evidence.",
      "结合刚才的自我介绍，哪项学习成绩最能体现你的能力？请给出具体依据。"
    ],
    SCHOOL_MAJOR: [
      `Vì sao bạn chọn ${major} tại ${school}, và lựa chọn này liên hệ thế nào với kinh nghiệm trước đây của bạn?`,
      `Why did you choose ${major} at ${school}, and how does that choice connect with your previous experience?`,
      `你为什么选择在${school}学习${major}？这个选择与你过去的经历有什么联系？`
    ],
    MAJOR_EXPERTISE: [
      `Hãy chọn một vấn đề cốt lõi của ${major}, phân tích nguyên nhân và đề xuất cách tiếp cận của bạn.`,
      `Choose one core problem in ${major}, analyze its causes, and propose your approach.`,
      `请选择${major}中的一个核心问题，分析其原因，并说明你的解决思路。`
    ],
    STUDY_PLAN: [
      `Trong năm đầu học ${major}, bạn sẽ ưu tiên kiến thức, kỹ năng và kết quả đo lường nào?`,
      `In your first year studying ${major}, which knowledge, skills, and measurable outcomes will you prioritize?`,
      `学习${major}的第一年，你会优先掌握哪些知识和技能？你将如何衡量成果？`
    ],
    SCHOLARSHIP_CAREER: [
      "Học bổng này sẽ giúp bạn thực hiện mục tiêu học tập và nghề nghiệp như thế nào? Nếu không nhận được, kế hoạch thay thế của bạn là gì?",
      "How will this scholarship support your academic and career goals, and what is your alternative plan if you do not receive it?",
      "这项奖学金将如何帮助你实现学习和职业目标？如果未能获得，你的替代计划是什么？"
    ],
    SITUATION: [
      `Nếu quan điểm chuyên môn của bạn về ${major} bị giảng viên phản biện, bạn sẽ kiểm chứng và bảo vệ hoặc điều chỉnh lập luận ra sao?`,
      `If a professor challenges your view on ${major}, how would you verify, defend, or revise your argument?`,
      `如果老师质疑你对${major}的专业观点，你会如何验证、辩护或调整自己的论证？`
    ]
  };

  const languageIndex = input.language === LanguageCode.VI ? 0 : input.language === LanguageCode.EN ? 1 : 2;
  return questions[input.phase][languageIndex];
}

function categoryForPhase(phase: InterviewPhaseDefinition, count: number) {
  if (phase.key === "SCHOLARSHIP_CAREER") {
    return count % 2 === 0 ? QuestionCategory.SCHOLARSHIP : QuestionCategory.CAREER_PLAN;
  }
  return phase.categories[0];
}

function emptyPhaseCounts(): Record<InterviewPhaseKey, number> {
  return {
    ACADEMIC: 0,
    INTRODUCTION: 0,
    MAJOR_EXPERTISE: 0,
    SCHOLARSHIP_CAREER: 0,
    SCHOOL_MAJOR: 0,
    SITUATION: 0,
    STUDY_PLAN: 0
  };
}

function localized(language: LanguageCode, vi: string, en: string, zh: string) {
  return language === LanguageCode.VI ? vi : language === LanguageCode.EN ? en : zh;
}

function localizedTarget(value: string | null | undefined, language: LanguageCode, fallback: string) {
  const cleaned = value?.trim();
  if (!cleaned) return fallback;
  const hasHan = /[\u3400-\u9fff]/u.test(cleaned);
  const hasVietnamese = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(cleaned);
  if (language === LanguageCode.ZH && !hasHan) return fallback;
  if (language === LanguageCode.EN && (hasHan || hasVietnamese)) return fallback;
  if (language === LanguageCode.VI && hasHan) return fallback;
  return cleaned;
}
