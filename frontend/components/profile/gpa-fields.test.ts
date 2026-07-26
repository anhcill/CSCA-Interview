import { describe, expect, it } from "vitest";
import {
  formatBachelorGpa,
  normalizeLegacyMasterGpa,
  parseBachelorGpa
} from "./gpa-value";

describe("GPA fields", () => {
  it("maps bachelor GPA to three high-school grade fields", () => {
    expect(parseBachelorGpa("Lớp 10: 8,5; Lớp 11: 8.75; Lớp 12: 9")).toEqual({
      grade10: "8.5",
      grade11: "8.75",
      grade12: "9"
    });
    expect(formatBachelorGpa({ grade10: "8.5", grade11: "8.75", grade12: "9" }))
      .toBe("Lớp 10: 8.5; Lớp 11: 8.75; Lớp 12: 9");
  });

  it("keeps partially entered bachelor grades while the user is typing", () => {
    expect(parseBachelorGpa("Lớp 10: 8.5; Lớp 11: ; Lớp 12: ")).toEqual({
      grade10: "8.5",
      grade11: "",
      grade12: ""
    });
  });

  it("normalizes legacy master GPA on a four-point scale", () => {
    expect(normalizeLegacyMasterGpa("3,60/4.0")).toBe("3.60");
    expect(normalizeLegacyMasterGpa("Lớp 10: 8; Lớp 11: 8; Lớp 12: 9")).toBe("");
  });
});
