import { InterviewMode, LanguageCode } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createInterviewSchema, submitAnswerSchema } from "./interviews.schemas.js";

describe("createInterviewSchema", () => {
  it("defaults a new interview to Chinese", () => {
    const parsed = createInterviewSchema.parse({});
    expect(parsed.language).toBe(LanguageCode.ZH);
    expect(parsed.mode).toBe(InterviewMode.PRACTICE);
  });

  it("keeps an explicitly selected interview language", () => {
    expect(createInterviewSchema.parse({ language: LanguageCode.VI }).language).toBe(LanguageCode.VI);
    expect(createInterviewSchema.parse({ language: LanguageCode.EN }).language).toBe(LanguageCode.EN);
  });

  it("accepts canonical application target IDs", () => {
    const parsed = createInterviewSchema.parse({
      majorId: "11111111-1111-4111-8111-111111111111",
      scholarshipId: "22222222-2222-4222-8222-222222222222",
      schoolId: "33333333-3333-4333-8333-333333333333"
    });

    expect(parsed.majorId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed.scholarshipId).toBe("22222222-2222-4222-8222-222222222222");
    expect(parsed.schoolId).toBe("33333333-3333-4333-8333-333333333333");
  });
});

describe("submitAnswerSchema", () => {
  it("requires an idempotency submission ID", () => {
    const input = {
      answerText: "Câu trả lời thử nghiệm",
      sessionQuestionId: "11111111-1111-4111-8111-111111111111",
      submissionId: "22222222-2222-4222-8222-222222222222"
    };

    expect(submitAnswerSchema.parse(input).submissionId).toBe(input.submissionId);
    expect(submitAnswerSchema.safeParse({
      answerText: input.answerText,
      sessionQuestionId: input.sessionQuestionId
    }).success).toBe(false);
  });
});
