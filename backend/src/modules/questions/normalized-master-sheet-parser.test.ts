import { describe, expect, it } from "vitest";
import { parseNormalizedMasterSheetCsv } from "./normalized-master-sheet-parser.js";

const headers = [
  "mã_câu_hỏi",
  "trạng_thái",
  "năm",
  "trường_chuẩn",
  "alias_trường",
  "bậc_học",
  "ngành_chuẩn",
  "ngôn_ngữ_gốc",
  "câu_hỏi_gốc",
  "câu_hỏi_tiếng_trung",
  "câu_hỏi_tiếng_anh",
  "gợi_ý_trả_lời_tiếng_trung",
  "gợi_ý_trả_lời_tiếng_anh",
  "logic_chấm_điểm",
  "từ_khóa",
  "lỗi_thường_gặp",
  "danh_mục",
  "độ_khó",
  "rubric_code",
  "rubric_json",
  "khóa_bản_dịch",
  "ghi_chú",
  "nguồn_sheet",
  "nguồn_dòng"
];

function toCsvCell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

function row(values: Array<string | number | null>) {
  return values.map(toCsvCell).join(",");
}

describe("normalized master sheet parser", () => {
  it("turns one ready source row into Chinese and English interview questions", () => {
    const csv = [
      row(headers),
      row([
        "Q-2026-001",
        "sẵn_sàng_import",
        2026,
        "Đại học A",
        "",
        "Thạc sĩ",
        "AI",
        "VI",
        "Vì sao bạn chọn ngành AI?",
        "你为什么选择人工智能专业？",
        "Why did you choose Artificial Intelligence?",
        "答案 mẫu",
        "Sample answer",
        "Nêu động lực, nền tảng và kế hoạch học tập.",
        "AI, study plan",
        "Trả lời chung chung.",
        "SCHOOL_MAJOR",
        "MEDIUM",
        "SCHOOL_MAJOR_DEFAULT",
        "{\"relevance\":30}",
        "không",
        "",
        "GỐC_2026",
        12
      ])
    ].join("\n");

    const parsed = parseNormalizedMasterSheetCsv(csv);

    expect(parsed?.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(parsed?.questions).toHaveLength(2);
    expect(parsed?.questions.map((question) => question.language)).toEqual(["ZH", "EN"]);
    expect(parsed?.questions[0]).toMatchObject({
      category: "SCHOOL_MAJOR",
      degreeLevel: "MASTER",
      difficulty: "MEDIUM",
      majorName: "AI",
      questionCode: "Q-2026-001",
      schoolName: "Đại học A"
    });
  });

  it("skips rows that are not ready to import", () => {
    const csv = [
      row(headers),
      row(["Q-DRAFT", "nháp", 2026, "Đại học A", "", "Đại học", "", "VI", "Câu nháp", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""])
    ].join("\n");

    const parsed = parseNormalizedMasterSheetCsv(csv);

    expect(parsed?.questions).toHaveLength(0);
    expect(parsed?.skippedRows).toHaveLength(1);
    expect(parsed?.skippedRows[0]?.reason).toContain("chưa sẵn sàng import");
  });

  it("reports an error when a ready row has no Chinese or English interview question", () => {
    const csv = [
      row(headers),
      row(["Q-MISSING", "sẵn_sàng_import", 2026, "Đại học A", "", "Thạc sĩ", "AI", "VI", "Câu tiếng Việt chưa dịch", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""])
    ].join("\n");

    const parsed = parseNormalizedMasterSheetCsv(csv);

    expect(parsed?.questions).toHaveLength(0);
    expect(parsed?.issues.some((issue) => issue.code === "MISSING_INTERVIEW_LANGUAGE" && issue.severity === "error")).toBe(true);
  });
});
