import { describe, expect, it } from "vitest";
import {
  deduplicateBatchQuestions,
  normalizeQuestionText
} from "./question-batch.service.js";

describe("question-batch service", () => {
  it("chuẩn hóa khoảng trắng và chữ hoa để phát hiện câu trùng", () => {
    expect(normalizeQuestionText("  Vì sao   bạn chọn ngành này? ")).toBe("vì sao bạn chọn ngành này?");
  });

  it("loại câu trùng trong cùng một lần nhập hàng loạt", () => {
    const questions = deduplicateBatchQuestions([
      { questionText: "Vì sao bạn chọn ngành này?" },
      { questionText: " Vì sao   bạn chọn ngành này? " },
      { questionText: "Mục tiêu nghề nghiệp của bạn là gì?" }
    ]);

    expect(questions).toHaveLength(2);
    expect(questions[1]?.questionText).toContain("Mục tiêu nghề nghiệp");
  });
});
