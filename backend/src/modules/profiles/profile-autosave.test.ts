import { describe, expect, it } from "vitest";
import { normalizeOtherLanguagesInput } from "./profile-autosave.js";

describe("profile autosave", () => {
  it("lưu nội dung đã loại bỏ khoảng trắng thừa", () => {
    expect(normalizeOtherLanguagesInput("  HSK 5 | IELTS 7.0  ")).toBe("HSK 5 | IELTS 7.0");
  });

  it("chuyển nội dung bị xóa thành null để xóa dữ liệu cũ", () => {
    expect(normalizeOtherLanguagesInput("   ")).toBeNull();
    expect(normalizeOtherLanguagesInput(null)).toBeNull();
  });
});
