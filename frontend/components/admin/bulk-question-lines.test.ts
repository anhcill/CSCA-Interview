import { describe, expect, it } from "vitest";
import { parseBulkQuestionLines } from "./bulk-question-lines";

describe("parseBulkQuestionLines", () => {
  it("đọc mỗi dòng thành một câu và bỏ số thứ tự", () => {
    expect(parseBulkQuestionLines("1. Câu thứ nhất?\n- Câu thứ hai?")).toEqual([
      "Câu thứ nhất?",
      "Câu thứ hai?"
    ]);
  });

  it("bỏ dòng trống và câu trùng", () => {
    expect(parseBulkQuestionLines("Câu hỏi chung?\n\n Câu hỏi chung? ")).toEqual([
      "Câu hỏi chung?"
    ]);
  });
});
