import { describe, expect, it } from "vitest";
import { getInterviewCompletionCopy } from "./interview-completion-copy";

describe("getInterviewCompletionCopy", () => {
  it("thông báo rõ AI vẫn đang chấm khi kết thúc phỏng vấn", () => {
    const copy = getInterviewCompletionCopy("scoring");

    expect(copy.title).toContain("AI");
    expect(copy.description).toContain("chấm từng câu trả lời");
  });

  it("thông báo khi đang chuyển sang báo cáo", () => {
    const copy = getInterviewCompletionCopy("opening_result");

    expect(copy.title).toContain("báo cáo");
    expect(copy.description).toContain("trang kết quả");
  });
});
