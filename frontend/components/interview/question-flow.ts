import type { InterviewQuestionDto } from "@/lib/interview-client";
import type { InterviewLanguageMode } from "@/lib/i18n";
import { type ChatMessage, interviewQuestions } from "./interview-data";

export type RoomQuestion = {
  aiReason?: string | null;
  category: string;
  difficulty?: string;
  expectedAnswerLogic?: string | null;
  followUpDepth?: number;
  id: string;
  isFollowUp?: boolean;
  language?: "VI" | "ZH" | "EN";
  questionText: string;
  source?: string;
  translation?: string | null;
};

export const fallbackQuestions: RoomQuestion[] = interviewQuestions.map((question, index) => ({
  category: question.category,
  expectedAnswerLogic: question.vi,
  id: `fallback-${index}`,
  questionText: question.zh,
  translation: question.vi
}));

export function mapQuestions(questions: InterviewQuestionDto[]): RoomQuestion[] {
  return questions.map(mapQuestion);
}

export function mapQuestion(question: InterviewQuestionDto): RoomQuestion {
  return {
    aiReason: question.aiReason,
    category: question.category,
    difficulty: question.difficulty,
    expectedAnswerLogic: question.expectedAnswerLogic,
    id: question.id,
    language: question.language,
    questionText: question.questionText,
    source: question.source
  };
}

export function getQuestionDisplayText(question: RoomQuestion, mode: InterviewLanguageMode) {
  if (mode === "VI" && question.language === "VI") return question.questionText;
  if (mode === "VI" && question.translation) return question.translation;
  return question.questionText;
}

export function getQuestionSupportText(question: RoomQuestion) {
  return question.translation ?? question.expectedAnswerLogic ?? undefined;
}

export function buildAiMessage(
  question: RoomQuestion,
  id: number,
  mode: InterviewLanguageMode,
  time = getClockTime(),
  prefix = ""
): ChatMessage {
  const isBilingual = mode === "BILINGUAL";
  const contentText = getQuestionDisplayText(question, mode);

  return {
    id,
    author: "ai",
    content: `${prefix}${contentText}`,
    translation: isBilingual ? getQuestionSupportText(question) : undefined,
    time
  };
}

export function getClockTime() {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

export function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatDuration(minutes: number | null) {
  if (!minutes) return "Không giới hạn";
  if (minutes === 60) return "1 giờ";
  if (minutes % 60 === 0) return `${minutes / 60} giờ`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
  return `${minutes} phút`;
}
