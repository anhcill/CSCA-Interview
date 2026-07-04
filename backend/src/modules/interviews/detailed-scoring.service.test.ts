import { describe, expect, it, vi } from "vitest";
import { DifficultyLevel, InterviewStatus, LanguageCode, QuestionCategory, QuestionSource } from "@prisma/client";
import { buildSessionAnalysis } from "./detailed-scoring.service.js";

vi.mock("../ai/ai.service.js", () => ({
  scoreInterviewAnswerDetailed: vi.fn().mockReturnValue({
    academicKeywords: ["fallback"],
    confidence: 8,
    content: 8.5,
    expertise: 8.5,
    feedback: "Fallback feedback",
    improvedAnswer: "Fallback improved answer",
    impression: 8,
    language: 7.5,
    logic: 8,
    strengths: ["Fallback strength"],
    tips: ["Fallback tip"],
    total: 8.1,
    weaknesses: ["Fallback weakness"]
  })
}));

describe("Detailed Scoring Service - buildSessionAnalysis", () => {
  it("uses persisted AI scores and feedback before heuristic fallback", () => {
    const mockSession = {
      id: "session-uuid",
      userId: "user-uuid",
      profileId: "profile-uuid",
      status: InterviewStatus.COMPLETED,
      startedAt: new Date(),
      endedAt: new Date(),
      totalQuestions: 2,
      answeredQuestions: 1,
      plannedDurationMinutes: 30,
      language: LanguageCode.ZH,
      mode: "PRACTICE" as any,
      schoolId: null,
      majorId: null,
      scholarshipId: null,
      scholarshipType: "CSC",
      targetSchool: "Tsinghua University",
      targetMajor: "Computer Science",
      totalScore: null,
      summaryFeedback: null,
      sourceSessionId: null,
      rePracticeType: null,
      answers: [
        {
          id: "answer-1",
          sessionId: "session-uuid",
          sessionQuestionId: "sq-1",
          userId: "user-uuid",
          answerText: "I want to study in China because the program matches my research plan.",
          scoreLanguage: 8.0 as any,
          scoreLogic: 7.5 as any,
          scoreRelevance: 8.0 as any,
          scoreSpecificity: 8.5 as any,
          scoreTotal: 8.0 as any,
          feedback: "Persisted AI feedback",
          improvedAnswer: "Persisted improved answer",
          strengths: "Directly answers the question\nClear academic goal",
          weaknesses: "Needs a personal example",
          tips: null,
          answeredAt: new Date(),
          sessionQuestion: {
            id: "sq-1",
            sessionId: "session-uuid",
            questionId: "q-1",
            source: QuestionSource.ADMIN_BANK,
            orderIndex: 1,
            questionText: "Why do you want to study in China?",
            category: QuestionCategory.SCHOLARSHIP,
            difficulty: DifficultyLevel.MEDIUM,
            language: LanguageCode.ZH,
            aiReason: null,
            expectedAnswerLogic: null,
            question: {
              keywords: "study, china, research",
              sampleAnswer: "I want to study in China...",
              suggestedAnswerLogic: "Connect motivation, academic fit, and plan."
            }
          },
          voice_recordings: []
        }
      ]
    };

    const analysis = buildSessionAnalysis(mockSession as any);

    expect(analysis.overallScore).toBe(8);
    expect(analysis.criteriaAverages.content).toBe(8.5);
    expect(analysis.criteriaAverages.logic).toBe(7.5);
    expect(analysis.strengths).toContain("Directly answers the question");
    expect(analysis.weaknesses).toContain("Needs a personal example");
    expect(analysis.answerDetails[0].feedback).toBe("Persisted AI feedback");
    expect(analysis.answerDetails[0].improvedAnswer).toBe("Persisted improved answer");
    expect(analysis.answerDetails[0].scoringSource).toBe("ai");
    expect(analysis.answerDetails[0].strengths).not.toContain("Fallback strength");
  });

  it("keeps heuristic answer details out of official aggregate scores", () => {
    const mockSession = {
      id: "session-uuid",
      userId: "user-uuid",
      profileId: "profile-uuid",
      status: InterviewStatus.COMPLETED,
      startedAt: new Date(),
      endedAt: new Date(),
      totalQuestions: 1,
      answeredQuestions: 1,
      plannedDurationMinutes: 30,
      language: LanguageCode.ZH,
      mode: "PRACTICE" as any,
      schoolId: null,
      majorId: null,
      scholarshipId: null,
      scholarshipType: "CSC",
      targetSchool: "Tsinghua University",
      targetMajor: "Computer Science",
      totalScore: null,
      summaryFeedback: null,
      sourceSessionId: null,
      rePracticeType: null,
      answers: [
        {
          id: "answer-1",
          sessionId: "session-uuid",
          sessionQuestionId: "sq-1",
          userId: "user-uuid",
          answerText: "I want to study in China because the program matches my research plan.",
          scoreLanguage: null,
          scoreLogic: null,
          scoreRelevance: null,
          scoreSpecificity: null,
          scoreTotal: null,
          feedback: null,
          improvedAnswer: null,
          strengths: null,
          weaknesses: null,
          tips: null,
          answeredAt: new Date(),
          sessionQuestion: {
            id: "sq-1",
            sessionId: "session-uuid",
            questionId: "q-1",
            source: QuestionSource.ADMIN_BANK,
            orderIndex: 1,
            questionText: "Why do you want to study in China?",
            category: QuestionCategory.SCHOLARSHIP,
            difficulty: DifficultyLevel.MEDIUM,
            language: LanguageCode.ZH,
            aiReason: null,
            expectedAnswerLogic: null,
            question: {
              keywords: "study, china, research",
              sampleAnswer: "I want to study in China...",
              suggestedAnswerLogic: "Connect motivation, academic fit, and plan."
            }
          },
          voice_recordings: []
        }
      ]
    };

    const analysis = buildSessionAnalysis(mockSession as any);

    expect(analysis.overallScore).toBe(0);
    expect(analysis.criteriaAverages.content).toBe(0);
    expect(analysis.answerDetails[0].scoringSource).toBe("heuristic");
    expect(analysis.answerDetails[0].scores.total).toBe(8.1);
    expect(analysis.sessionSummary).toContain("chưa có điểm AI chính thức");
  });
});
