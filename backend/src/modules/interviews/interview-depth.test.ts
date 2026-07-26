import { describe, expect, it } from "vitest";
import {
  analyzeInterviewDepth,
  shouldSwitchInterviewTopic
} from "./interview-depth.js";

describe("interview depth strategy", () => {
  it("asks for an example at depth one when evidence is missing", () => {
    const analysis = analyzeInterviewDepth({
      answerText: "Tôi muốn phát triển trong lĩnh vực thương mại điện tử.",
      requestedDepth: 1
    });

    expect(analysis.strategy).toBe("CLARIFY_AND_EXAMPLE");
    expect(analysis.missingContent).toContain("ví dụ hoặc trải nghiệm cụ thể");
    expect(analysis.hasEnoughEvidence).toBe(false);
  });

  it("moves to method and result at depth two", () => {
    expect(analyzeInterviewDepth({
      answerText: "Tôi từng tham gia một dự án bán hàng.",
      requestedDepth: 2
    }).strategy).toBe("ROLE_METHOD_RESULT");
  });

  it("moves to challenge, risk, and backup at depth three", () => {
    expect(analyzeInterviewDepth({
      answerText: "Tôi phụ trách dự án và cải thiện kết quả 20%.",
      requestedDepth: 3
    }).strategy).toBe("CHALLENGE_RISK_BACKUP");
  });

  it("switches topic when time is needed for required groups", () => {
    expect(shouldSwitchInterviewTopic({
      consecutiveWeakAnswers: 0,
      currentDepth: 1,
      hasEnoughEvidence: false,
      remainingMinutes: 6,
      requiredTopicsRemaining: 2
    })).toBe(true);
  });
});
