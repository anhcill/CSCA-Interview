import { describe, expect, it } from "vitest";
import { parseInterviewSheetCsv } from "./interview-sheet-parser.js";

function toCsvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

describe("interview sheet parser", () => {
  it("parses bachelor rows with Vietnamese degree text and multiline question blocks", () => {
    const csv = [
      ",List phỏng vấn du học Trung Quốc năm 2026,,,,,",
      ",,,,,,",
      [
        "1",
        "Đại học Sư phạm Nam Kinh ( NJNU )",
        "Đại học",
        "( ngành 教育学 )\n1.自我介绍\n2.你对教育有什么了解\n3. 你觉得教育专业有什么意义",
        "Ngành kinh tế\n请做一下自我介绍。\n→ Hãy tự giới thiệu bản thân.\n你为什么选择来中国学习？\n→ Tại sao bạn chọn sang Trung Quốc học tập?",
        "",
        ""
      ].map(toCsvCell).join(",")
    ].join("\n");

    const parsed = parseInterviewSheetCsv(csv);

    expect(parsed.stats.schools).toBe(1);
    expect(parsed.questions).toHaveLength(5);
    expect(parsed.questions[0]).toMatchObject({
      degreeLevel: "BACHELOR",
      language: "ZH",
      majorName: "教育学",
      questionText: "自我介绍",
      schoolName: "Đại học Sư phạm Nam Kinh ( NJNU )"
    });
    expect(parsed.questions[3]?.questionText).toContain("Hãy tự giới thiệu bản thân");
  });

  it("keeps master rows under the current school and separates numbered Vietnamese questions", () => {
    const csv = [
      [
        "2",
        "Đại học Vũ Hán ( WHU)",
        "Đại học",
        "",
        "",
        "",
        ""
      ].map(toCsvCell).join(","),
      [
        "",
        "",
        "Thạc sĩ",
        "Ngành GDHNQT\n1. Một phút giới thiệu bản thân\n2. Tại sao lại lựa chọn Đại học Vũ Hán? Tìm hiểu đại học Vũ Hán qua đâu?",
        "",
        "",
        ""
      ].map(toCsvCell).join(",")
    ].join("\n");

    const parsed = parseInterviewSheetCsv(csv);

    expect(parsed.questions.map((question) => question.questionText)).toEqual([
      "Một phút giới thiệu bản thân",
      "Tại sao lại lựa chọn Đại học Vũ Hán?",
      "Tìm hiểu đại học Vũ Hán qua đâu?"
    ]);
    expect(parsed.questions.every((question) => question.degreeLevel === "MASTER")).toBe(true);
    expect(parsed.questions.every((question) => question.schoolName === "Đại học Vũ Hán ( WHU)")).toBe(true);
  });
});
