import { describe, expect, it } from "vitest";
import { generateFollowUpQuestion, type FollowUpInput } from "./ai.service.js";

const baseInput: FollowUpInput = {
  answerText: "Tôi từng tham gia một dự án thương mại điện tử.",
  category: "RESEARCH",
  conversationHistory: [],
  difficulty: "MEDIUM",
  language: "VI",
  scholarshipType: "CSC",
  targetMajor: "Thương mại điện tử",
  targetSchool: "Trường mục tiêu"
};

describe("deterministic multi-depth follow-up", () => {
  it("asks for role, method, and result at depth two", () => {
    const result = generateFollowUpQuestion({ ...baseInput, currentDepth: 2 });
    expect(result.questionText).toMatch(/vai trò|phương pháp|kết quả/iu);
  });

  it("challenges risk and backup plan at depth three", () => {
    const result = generateFollowUpQuestion({ ...baseInput, currentDepth: 3 });
    expect(result.questionText).toMatch(/rủi ro|phương án dự phòng/iu);
  });
});
