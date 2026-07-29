import { describe, expect, it } from "vitest";
import { parseMajorLines } from "./major-lines";

describe("parseMajorLines", () => {
  it("đọc tên Việt, Trung, Anh từ một dòng", () => {
    expect(parseMajorLines("Thương mại điện tử | 电子商务 | E-commerce", "BACHELOR")).toEqual([
      {
        degreeLevel: "BACHELOR",
        name: "Thương mại điện tử",
        nameEn: "E-commerce",
        nameZh: "电子商务"
      }
    ]);
  });

  it("bỏ số thứ tự, dòng trống và ngành trùng", () => {
    expect(parseMajorLines("1. Kinh tế quốc tế\n- Kinh tế quốc tế\n\nKhoa học máy tính", "MASTER")).toHaveLength(2);
  });
});
