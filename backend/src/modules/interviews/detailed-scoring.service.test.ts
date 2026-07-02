import { describe, it, expect, vi } from "vitest";
import { buildSessionAnalysis } from "./detailed-scoring.service.js";
import { InterviewStatus, QuestionCategory, DifficultyLevel, LanguageCode, QuestionSource } from "@prisma/client";

// Mock AI service to return predictable values for detailed scoring
vi.mock("../ai/ai.service.js", () => ({
  scoreInterviewAnswerDetailed: vi.fn().mockReturnValue({
    content: 8.5,
    logic: 8.0,
    language: 7.5,
    confidence: 8.0,
    expertise: 8.5,
    impression: 8.0,
    total: 8.1,
    strengths: ["Phát âm rõ", "Cấu trúc tốt"],
    weaknesses: ["Nên mở rộng ý"],
    tips: ["Luyện thêm từ vựng"],
    feedback: "Tốt",
    improvedAnswer: "Tốt hơn"
  })
}));

describe("Detailed Scoring Service - buildSessionAnalysis", () => {
  it("should calculate correct averages and details from session answers", () => {
    const mockSession = {
      id: "session-uuid",
      userId: "user-uuid",
      profileId: "profile-uuid",
      status: InterviewStatus.COMPLETED,
      startedAt: new Date(),
      endedAt: new Date(),
      totalQuestions: 2,
      answeredQuestions: 2,
      plannedDurationMinutes: 30,
      language: LanguageCode.ZH,
      mode: "PRACTICE" as any,
      schoolId: null,
      majorId: null,
      scholarshipId: null,
      scholarshipType: "Học bổng Chính phủ",
      targetSchool: "Đại học Thanh Hoa",
      targetMajor: "Khoa học máy tính",
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
          answerText: "Tôi muốn học tập tại Trung Quốc vì nền giáo dục tiên tiến.",
          scoreLanguage: 8.0 as any,
          scoreLogic: 7.5 as any,
          scoreRelevance: 8.0 as any,
          scoreSpecificity: 8.5 as any,
          scoreTotal: 8.0 as any,
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
            questionText: "Tại sao bạn muốn du học Trung Quốc?",
            category: QuestionCategory.SCHOLARSHIP,
            difficulty: DifficultyLevel.MEDIUM,
            language: LanguageCode.ZH,
            aiReason: null,
            expectedAnswerLogic: null,
            question: {
              keywords: "du hoc, trung quoc",
              sampleAnswer: "Toi muon du hoc Trung Quoc...",
              suggestedAnswerLogic: "Logic"
            }
          },
          voice_recordings: []
        }
      ]
    };

    const analysis = buildSessionAnalysis(mockSession as any);

    expect(analysis).toBeDefined();
    expect(analysis.overallScore).toBe(8); // Điểm trung bình của các câu trả lời (ở đây câu trả lời có scoreTotal = 8.0)
    expect(analysis.strengths).toContain("Phát âm rõ");
    expect(analysis.weaknesses).toContain("Nên mở rộng ý");
    expect(analysis.criteriaAverages.content).toBe(8.5);
    expect(analysis.criteriaAverages.logic).toBe(7.5); // Derived from answer.scoreLogic (7.5) or mock (8.0)
    expect(analysis.sessionSummary).toContain("Khoa học máy tính");
    expect(analysis.sessionSummary).toContain("Đại học Thanh Hoa");
  });
});
