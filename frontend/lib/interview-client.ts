import { createAuthorizedJsonEventStream, apiGet, apiPost } from "./api";
import { getAuthToken } from "./auth-client";
import type { PronunciationResult, SpeechMetrics } from "./speech-client";

export type InterviewQuestionDto = {
  aiReason?: string | null;
  category: string;
  difficulty: string;
  expectedAnswerLogic: string | null;
  id: string;
  language: "VI" | "ZH" | "EN";
  orderIndex: number;
  questionText: string;
  source: "ADMIN_BANK" | "AI_GENERATED";
};

export type NextInterviewQuestionResponse = {
  aiThinking: boolean;
  followUpDepth?: number;
  generated: boolean;
  isFollowUp?: boolean;
  question: InterviewQuestionDto;
};

export type InterviewAnswerDto = {
  answerText: string | null;
  feedback: string | null;
  id: string;
  improvedAnswer: string | null;
  scoreLanguage: string | null;
  scoreLogic: string | null;
  scoreRelevance: string | null;
  scoreSpecificity: string | null;
  scoreTotal: string | null;
  sessionQuestionId: string;
  strengths?: string | null;
  voiceRecording?: VoiceRecordingDto | null;
  weaknesses?: string | null;
};

export type VoiceRecordingDto = {
  createdAt: string;
  feedback: unknown;
  fluencyScore: string | null;
  id: string;
  language: "VI" | "ZH" | "EN";
  pronunciationScore: string | null;
  speedWordsPerMinute: string | null;
  transcript: string | null;
};

export type AnswerDetailedAnalysisDto = {
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
  speech?: {
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

export type InterviewAnalysisDto = {
  criteriaAverages: {
    content: number;
    logic: number;
    language: number;
    confidence: number;
    expertise: number;
    impression: number;
  };
  improvementTips: string[];
  overallScore: number;
  progressHint: string;
  speechSummary?: string | null;
  sessionSummary: string;
  strengths: string[];
  weaknesses: string[];
  answerDetails?: AnswerDetailedAnalysisDto[];
};

export type InterviewReportDto = {
  id: string;
  languageFeedback: string | null;
  logicFeedback: string | null;
  nextSteps: string[];
  overallScore: number;
  recommendedPractice: string[];
  repeatedMistakes: string[];
  summary: string | null;
};

export type InterviewSessionDto = {
  answers: InterviewAnswerDto[];
  answeredQuestions: number;
  degreeLevel: "BACHELOR" | "MASTER" | null;
  id: string;
  language: "VI" | "ZH" | "EN";
  majorId: string | null;
  mode: "PRACTICE" | "MOCK_TEST" | "SCORING";
  plannedDurationMinutes: number | null;
  questions: InterviewQuestionDto[];
  schoolId: string | null;
  scholarshipId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: "DRAFT" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";
  targetMajor: string | null;
  targetSchool: string | null;
  totalQuestions: number;
};

type CreateInterviewResponse = {
  session: InterviewSessionDto;
};

export type SubmitInterviewAnswerResponse = {
  answer: {
    answerText: string | null;
    feedback: string | null;
    id: string;
    improvedAnswer: string | null;
    scoreTotal: string | null;
    sessionQuestionId: string;
    voiceRecording?: VoiceRecordingDto | null;
  };
  session: {
    answeredQuestions: number;
    status: InterviewSessionDto["status"];
  };
};

export type InterviewAnalysisResponse = {
  analysis: InterviewAnalysisDto;
  report: InterviewReportDto | null;
};

export const activeInterviewSessionStorageKey = "ai_phongvan_active_interview_session";

function getRequiredToken() {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Bạn cần đăng nhập để bắt đầu phỏng vấn");
  }

  return token;
}

export async function createInterviewSession(input: {
  age?: number;
  degreeLevel?: "BACHELOR" | "MASTER";
  fullName?: string;
  language?: "VI" | "ZH" | "EN";
  majorId?: string | null;
  mode?: "PRACTICE" | "MOCK_TEST" | "SCORING";
  plannedDurationMinutes?: number;
  schoolId?: string | null;
  scholarshipId?: string | null;
  scholarshipType?: string;
  studyPlan?: string;
  targetMajor?: string;
  targetSchool?: string;
} = {}) {
  return apiPost<CreateInterviewResponse>(
    "/api/interviews",
    {
      age: input.age,
      degreeLevel: input.degreeLevel,
      fullName: input.fullName,
      language: input.language ?? "ZH",
      majorId: input.majorId,
      mode: input.mode ?? "PRACTICE",
      plannedDurationMinutes: input.plannedDurationMinutes,
      schoolId: input.schoolId,
      scholarshipId: input.scholarshipId,
      scholarshipType: input.scholarshipType,
      studyPlan: input.studyPlan,
      targetMajor: input.targetMajor,
      targetSchool: input.targetSchool
    },
    { timeoutMs: 60_000, token: getRequiredToken() }
  );
}

export async function fetchInterviewSession(sessionId: string) {
  return apiGet<CreateInterviewResponse>(`/api/interviews/${sessionId}`, {
    token: getRequiredToken()
  });
}

export async function fetchInterviewAnalysis(sessionId: string) {
  return apiGet<InterviewAnalysisResponse>(`/api/interviews/${sessionId}/analysis`, {
    token: getRequiredToken()
  });
}

export async function submitInterviewAnswer(input: {
  answerText: string;
  pronunciation?: PronunciationResult | null;
  sessionId: string;
  sessionQuestionId: string;
  speechDurationSec?: number | null;
  speechLanguage?: string | null;
  speechMetrics?: SpeechMetrics | null;
  speechMimeType?: string | null;
  speechTranscript?: string | null;
}) {
  return apiPost<SubmitInterviewAnswerResponse>(
    `/api/interviews/${input.sessionId}/answers`,
    {
      answerText: input.answerText,
      pronunciation: input.pronunciation,
      sessionQuestionId: input.sessionQuestionId,
      speechDurationSec: input.speechDurationSec,
      speechLanguage: input.speechLanguage,
      speechMetrics: input.speechMetrics,
      speechMimeType: input.speechMimeType,
      speechTranscript: input.speechTranscript
    },
    { token: getRequiredToken() }
  );
}

export async function skipInterviewQuestion(input: {
  sessionId: string;
  sessionQuestionId: string;
}) {
  return apiPost<SubmitInterviewAnswerResponse>(
    `/api/interviews/${input.sessionId}/skip`,
    { sessionQuestionId: input.sessionQuestionId },
    { token: getRequiredToken() }
  );
}

export async function pauseInterviewSession(sessionId: string) {
  return apiPost<CreateInterviewResponse>(
    `/api/interviews/${sessionId}/pause`,
    undefined,
    { token: getRequiredToken() }
  );
}

export async function resumeInterviewSession(sessionId: string) {
  return apiPost<CreateInterviewResponse>(
    `/api/interviews/${sessionId}/resume`,
    undefined,
    { token: getRequiredToken() }
  );
}

export function streamInterviewAnswerFeedback(input: {
  answerText: string;
  onDone: (data: SubmitInterviewAnswerResponse) => void;
  onError: (message: string) => void;
  onStatus?: (status: string) => void;
  onToken: (token: string) => void;
  sessionId: string;
  sessionQuestionId: string;
}) {
  return createAuthorizedJsonEventStream(
    `/api/interviews/${input.sessionId}/answers/stream`,
    getRequiredToken(),
    {
      answerText: input.answerText,
      sessionQuestionId: input.sessionQuestionId
    },
    {
      onDone: (data) => input.onDone(data as SubmitInterviewAnswerResponse),
      onError: input.onError,
      onStatus: input.onStatus,
      onToken: input.onToken
    }
  );
}

export async function fetchNextInterviewQuestion(input: {
  forceAi?: boolean;
  sessionId: string;
}) {
  return apiPost<NextInterviewQuestionResponse>(
    `/api/interviews/${input.sessionId}/next-question`,
    { forceAi: input.forceAi ?? false },
    { token: getRequiredToken() }
  );
}

export async function completeInterviewSession(sessionId: string) {
  return apiPost<CreateInterviewResponse>(
    `/api/interviews/${sessionId}/complete`,
    undefined,
    { token: getRequiredToken() }
  );
}
