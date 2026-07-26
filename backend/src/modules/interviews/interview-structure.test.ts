import { LanguageCode, QuestionCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildPhaseFallbackQuestion,
  getInterviewQuestionLimit,
  interviewPhases,
  selectNextInterviewPhase
} from "./interview-structure.js";

describe("interview structure", () => {
  it("allocates seven structured questions for a 30-minute interview", () => {
    expect(getInterviewQuestionLimit(30)).toBe(7);
    expect(interviewPhases.map((phase) => phase.targetMinutes).reduce((total, value) => total + value, 0)).toBe(30);
  });

  it("covers phases in the required order", () => {
    const questions = interviewPhases.map((phase, index) => ({
      category: phase.categories[0],
      id: `question-${index + 1}`,
      orderIndex: index + 1
    }));

    for (let answeredCount = 0; answeredCount < interviewPhases.length; answeredCount += 1) {
      const decision = selectNextInterviewPhase(
        questions,
        questions.slice(0, answeredCount).map((question) => ({ sessionQuestionId: question.id }))
      );
      expect(decision.key).toBe(interviewPhases[answeredCount].key);
    }
  });

  it("deepens major expertise after all phases have been covered", () => {
    const questions = interviewPhases.map((phase, index) => ({
      category: phase.categories[0],
      id: `question-${index + 1}`,
      orderIndex: index + 1
    }));
    const decision = selectNextInterviewPhase(
      questions,
      questions.map((question) => ({ sessionQuestionId: question.id }))
    );

    expect(decision.key).toBe("MAJOR_EXPERTISE");
    expect(decision.category).toBe(QuestionCategory.RESEARCH);
    expect(decision.depth).toBe(2);
  });

  it("builds a Chinese fallback in the selected phase and target major", () => {
    const question = buildPhaseFallbackQuestion({
      language: LanguageCode.ZH,
      phase: "MAJOR_EXPERTISE",
      targetMajor: "电子商务"
    });

    expect(question).toContain("电子商务");
    expect(question).toMatch(/[\u3400-\u9fff]/u);
  });
});
