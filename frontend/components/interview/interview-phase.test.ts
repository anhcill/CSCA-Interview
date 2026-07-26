import { describe, expect, it } from "vitest";
import { getInterviewPhasePresentation } from "./interview-phase";

describe("interview phase presentation", () => {
  it("maps each question category to its interview phase", () => {
    expect(getInterviewPhasePresentation("PERSONAL")).toMatchObject({
      key: "INTRODUCTION",
      targetMinutes: 5
    });
    expect(getInterviewPhasePresentation("RESEARCH")).toMatchObject({
      key: "MAJOR_EXPERTISE",
      targetMinutes: 6
    });
    expect(getInterviewPhasePresentation("CAREER_PLAN").key).toBe("SCHOLARSHIP_CAREER");
  });
});
