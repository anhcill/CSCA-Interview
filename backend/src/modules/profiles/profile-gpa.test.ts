import { DegreeLevel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { normalizeAndValidateGpa } from "./profile-gpa.js";

describe("normalizeAndValidateGpa", () => {
  it("accepts and normalizes legacy master GPA on a 4-point scale", () => {
    expect(normalizeAndValidateGpa(DegreeLevel.MASTER, "3,60/4.0")).toEqual({
      error: null,
      value: "3.6"
    });
  });

  it("rejects master GPA above 4", () => {
    expect(normalizeAndValidateGpa(DegreeLevel.MASTER, "4.5").error).toBe(
      "GPA hệ thạc sĩ phải là GPA đại học theo thang 4."
    );
  });

  it("accepts all three high-school grades for bachelor applications", () => {
    expect(
      normalizeAndValidateGpa(
        DegreeLevel.BACHELOR,
        "Lớp 10: 8,50; Lớp 11: 8.75; Lớp 12: 9"
      )
    ).toEqual({
      error: null,
      value: "Lớp 10: 8.5; Lớp 11: 8.75; Lớp 12: 9"
    });
  });

  it("rejects missing high-school grade", () => {
    expect(
      normalizeAndValidateGpa(DegreeLevel.BACHELOR, "Lớp 10: 8.5; Lớp 12: 9").error
    ).toBe("GPA hệ đại học cần đủ điểm lớp 10, 11, 12 theo thang 10.");
  });

  it("rejects a high-school grade above 10", () => {
    expect(
      normalizeAndValidateGpa(
        DegreeLevel.BACHELOR,
        "Lớp 10: 8.5; Lớp 11: 9; Lớp 12: 10.5"
      ).error
    ).toBe("GPA hệ đại học cần đủ điểm lớp 10, 11, 12 theo thang 10.");
  });
});
