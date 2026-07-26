import { describe, expect, it } from "vitest";
import { shouldShowAudioAnalysis } from "./answer-feedback-policy";

describe("shouldShowAudioAnalysis", () => {
  it("hides audio analysis for keyboard answers", () => {
    expect(shouldShowAudioAnalysis({
      answerSource: "TEXT",
      audioScore: null,
      speech: null
    })).toBe(false);
  });

  it("requires actual speech metrics for microphone answers", () => {
    expect(shouldShowAudioAnalysis({
      answerSource: "MIC",
      audioScore: null,
      speech: null
    })).toBe(false);

    expect(shouldShowAudioAnalysis({
      answerSource: "MIC",
      audioScore: 82,
      speech: {
        confidenceScore: 80,
        fillerWordTotal: 1,
        fluencyScore: 84,
        pauseCount: 2,
        pronunciationScore: 82,
        tips: [],
        wpm: 112
      }
    })).toBe(true);
  });
});
