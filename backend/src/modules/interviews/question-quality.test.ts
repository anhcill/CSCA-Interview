import { LanguageCode } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  areNearDuplicateQuestions,
  isQuestionLanguageCompatible,
  mentionsUnrelatedMajor,
  validateInterviewQuestion
} from "./question-quality.js";

describe("interview question quality", () => {
  it("rejects international-relations content for e-commerce", () => {
    expect(mentionsUnrelatedMajor(
      "Bạn đánh giá vai trò của ngoại giao trong quan hệ quốc tế như thế nào?",
      "Thương mại điện tử"
    )).toBe(true);
  });

  it("rejects programming and architecture content for international relations", () => {
    expect(mentionsUnrelatedMajor("Hãy phân tích một thuật toán lập trình.", "Quan hệ quốc tế")).toBe(true);
    expect(mentionsUnrelatedMajor("Bạn yêu thích trường phái kiến trúc nào?", "Quan hệ quốc tế")).toBe(true);
  });

  it("allows a generic study-plan question", () => {
    expect(validateInterviewQuestion({
      language: LanguageCode.VI,
      questionText: "Bạn sẽ sắp xếp kế hoạch học tập trong năm đầu như thế nào?",
      targetMajor: "Thương mại điện tử"
    })).toEqual({ reasons: [], valid: true });
  });

  it("checks the selected interview language", () => {
    expect(isQuestionLanguageCompatible("请介绍一下你的学习计划。", LanguageCode.ZH)).toBe(true);
    expect(isQuestionLanguageCompatible("Please introduce your study plan.", LanguageCode.ZH)).toBe(false);
    expect(isQuestionLanguageCompatible("Please introduce your study plan.", LanguageCode.EN)).toBe(true);
    expect(isQuestionLanguageCompatible("Bạn hãy giới thiệu kế hoạch học tập.", LanguageCode.VI)).toBe(true);
  });

  it("detects exact and near-duplicate questions", () => {
    expect(areNearDuplicateQuestions(
      "Vì sao bạn chọn ngành Thương mại điện tử tại trường này?",
      "Vì sao bạn chọn ngành thương mại điện tử tại trường này?"
    )).toBe(true);
  });

  it("rejects generic follow-ups and unsupported school facts", () => {
    expect(validateInterviewQuestion({
      language: LanguageCode.VI,
      questionText: "Bạn có thể nói rõ hơn không?",
      targetMajor: "Thương mại điện tử"
    }).reasons).toContain("GENERIC");

    expect(validateInterviewQuestion({
      language: LanguageCode.VI,
      questionText: "Bạn muốn làm việc với giáo sư X tại phòng thí nghiệm hàng đầu của trường như thế nào?",
      ragContext: "Thông tin chương trình học tổng quát.",
      targetMajor: "Thương mại điện tử"
    }).reasons).toContain("UNSUPPORTED_SCHOOL_FACT");
  });
});
