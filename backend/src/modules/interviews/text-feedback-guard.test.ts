import { LanguageCode } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  containsAudioOnlyFeedback,
  isSafeImprovedAnswer,
  sanitizeTextOnlyFeedback
} from "./text-feedback-guard.js";

const fallback = {
  academicKeywords: [],
  feedback: "Phản hồi dự phòng",
  improvedAnswer: "Tôi muốn phát triển trong thương mại điện tử và sẽ bổ sung kế hoạch cụ thể.",
  strengths: ["Đúng trọng tâm"],
  tips: ["Bổ sung ví dụ"],
  weaknesses: ["Thiếu dẫn chứng"]
};

describe("text-only feedback guard", () => {
  it("detects forbidden audio feedback", () => {
    expect(containsAudioOnlyFeedback("Bạn nói dứt khoát và có ngữ điệu tốt.")).toBe(true);
    expect(containsAudioOnlyFeedback("Cách diễn đạt rõ ràng và có cam kết cụ thể.")).toBe(false);
  });

  it("replaces audio claims with evidence from the answer", () => {
    const result = sanitizeTextOnlyFeedback({
      answerText: "Tôi muốn phát triển trong thương mại điện tử.",
      fallback,
      language: LanguageCode.VI,
      payload: {
        ...fallback,
        feedback: "Giọng đọc dứt khoát.",
        strengths: ["Ngữ điệu tốt"]
      }
    });

    expect(result.feedback).toContain("thương mại điện tử");
    expect(result.feedback).not.toMatch(/giọng|ngữ điệu/iu);
    expect(result.strengths.join(" ")).not.toMatch(/giọng|ngữ điệu/iu);
  });

  it("rejects invented numbers and school facts in improved answers", () => {
    expect(isSafeImprovedAnswer({
      answerText: "Tôi từng tham gia một dự án.",
      improvedAnswer: "Tôi đã tăng doanh thu 35% và làm việc tại phòng thí nghiệm nổi tiếng.",
      language: LanguageCode.VI
    })).toBe(false);
  });
});
