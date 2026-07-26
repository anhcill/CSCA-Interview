import { describe, expect, it } from "vitest";
import {
  defaultTesterExperienceConfig,
  normalizeTesterExperienceConfig
} from "./site-experience.service.js";

describe("normalizeTesterExperienceConfig", () => {
  it("uses the active test defaults when no setting exists", () => {
    expect(normalizeTesterExperienceConfig(null)).toEqual(defaultTesterExperienceConfig);
  });

  it("merges a partial admin setting with safe defaults", () => {
    expect(normalizeTesterExperienceConfig({
      feedbackEnabled: false,
      welcomeMessage: "  Chào mừng nhóm test!  "
    })).toEqual({
      ...defaultTesterExperienceConfig,
      feedbackEnabled: false,
      welcomeMessage: "Chào mừng nhóm test!"
    });
  });

  it("does not accept invalid values or empty labels", () => {
    expect(normalizeTesterExperienceConfig({
      feedbackEnabled: "yes",
      feedbackTitle: " ",
      welcomeEnabled: 1
    })).toEqual(defaultTesterExperienceConfig);
  });
});
