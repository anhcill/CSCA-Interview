import { describe, expect, it } from "vitest";
import { buildSevenDayPracticePlan } from "./practice-plan.js";

describe("buildSevenDayPracticePlan", () => {
  it("creates seven ordered, actionable days", () => {
    const plan = buildSevenDayPracticePlan({
      hasSpeech: false,
      targetMajor: "Thương mại điện tử",
      weaknesses: ["Thiếu ví dụ"],
      weakestCriterion: "nội dung"
    });

    expect(plan).toHaveLength(7);
    expect(plan.map((item) => item.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(plan[0].activities.join(" ")).toContain("Thiếu ví dụ");
    expect(plan[3].activities.join(" ")).toContain("Thương mại điện tử");
    expect(plan[5].focus).toBe("Phản xạ");
  });

  it("uses actual voice practice only when speech data exists", () => {
    const plan = buildSevenDayPracticePlan({
      hasSpeech: true,
      weaknesses: [],
      weakestCriterion: "ngôn ngữ"
    });

    expect(plan[5].focus).toBe("Giọng nói");
    expect(plan[5].activities.join(" ")).toContain("Ghi âm");
  });
});
