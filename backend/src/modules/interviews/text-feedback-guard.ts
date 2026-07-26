import { LanguageCode } from "@prisma/client";
import { isQuestionLanguageCompatible } from "./question-quality.js";

const audioOnlyPattern = new RegExp([
  "giọng đọc",
  "giọng nói",
  "ngữ điệu",
  "phát âm",
  "tốc độ nói",
  "nói dứt khoát",
  "âm lượng",
  "voice",
  "tone",
  "intonation",
  "pronunciation",
  "speaking pace",
  "vocal",
  "语调",
  "发音",
  "语速",
  "音量"
].join("|"), "iu");

const riskyInventedFactPattern = /giáo sư|phòng thí nghiệm|phòng nghiên cứu|xếp hạng|professor|laboratory|research lab|ranked|教授|实验室|排名/iu;

export type TextFeedbackPayload = {
  academicKeywords: string[];
  feedback: string;
  improvedAnswer: string;
  strengths: string[];
  tips: string[];
  weaknesses: string[];
};

export function containsAudioOnlyFeedback(text: string) {
  return audioOnlyPattern.test(text);
}

export function sanitizeTextOnlyFeedback<T extends TextFeedbackPayload>(input: {
  answerText: string;
  fallback: T;
  language: LanguageCode;
  payload: T;
}): T {
  const evidence = extractAnswerEvidence(input.answerText);
  const cleanList = (values: string[], fallbackValues: string[]) => {
    const cleaned = values.filter((value) => !containsAudioOnlyFeedback(value));
    return cleaned.length ? cleaned : fallbackValues;
  };
  const feedback = containsAudioOnlyFeedback(input.payload.feedback)
    || !hasAnswerEvidence(input.payload.feedback, input.answerText)
    ? buildEvidenceFeedback(input.answerText, input.language)
    : input.payload.feedback.trim();
  const improvedAnswer = isSafeImprovedAnswer({
    answerText: input.answerText,
    improvedAnswer: input.payload.improvedAnswer,
    language: input.language
  })
    ? input.payload.improvedAnswer.trim()
    : input.fallback.improvedAnswer;

  return {
    ...input.payload,
    feedback,
    improvedAnswer,
    strengths: addEvidenceToGenericItems(
      cleanList(input.payload.strengths, input.fallback.strengths),
      evidence,
      input.language
    ),
    tips: cleanList(input.payload.tips, input.fallback.tips),
    weaknesses: addEvidenceToGenericItems(
      cleanList(input.payload.weaknesses, input.fallback.weaknesses),
      evidence,
      input.language
    )
  };
}

export function buildEvidenceFeedback(answerText: string, language: LanguageCode) {
  const evidence = extractAnswerEvidence(answerText);
  const hasNumber = /\d/u.test(answerText);
  const hasExample = /ví dụ|dự án|kinh nghiệm|example|project|experience|例如|项目|经历/iu.test(answerText);
  const missing = [
    !hasExample ? localized(language, "một ví dụ cá nhân", "a personal example", "一个个人实例") : null,
    !hasNumber ? localized(language, "mốc thời gian hoặc kết quả đo lường", "a timeline or measurable result", "时间节点或可衡量的结果") : null
  ].filter(Boolean).join(localized(language, " và ", " and ", "和"));

  if (language === LanguageCode.EN) {
    return `Your wording states “${evidence}”. This addresses the main direction, but it should add ${missing || "a clearer link to the application goal"}.`;
  }
  if (language === LanguageCode.ZH) {
    return `你的回答提到“${evidence}”。这一点方向明确，但还需要补充${missing || "与申请目标的具体联系"}。`;
  }
  return `Bạn nêu “${evidence}”. Ý này đúng hướng, nhưng cần bổ sung ${missing || "mối liên hệ cụ thể với mục tiêu ứng tuyển"}.`;
}

export function isSafeImprovedAnswer(input: {
  answerText: string;
  improvedAnswer: string;
  language: LanguageCode;
}) {
  const improved = input.improvedAnswer.trim();
  if (!improved || !isQuestionLanguageCompatible(improved, input.language)) return false;
  const originalNumbers = new Set(input.answerText.match(/\d+(?:[.,]\d+)?%?/gu) ?? []);
  const introducedNumber = (improved.match(/\d+(?:[.,]\d+)?%?/gu) ?? [])
    .some((value) => !originalNumbers.has(value));
  if (introducedNumber) return false;
  if (riskyInventedFactPattern.test(improved) && !riskyInventedFactPattern.test(input.answerText)) {
    return false;
  }
  return true;
}

function hasAnswerEvidence(feedback: string, answerText: string) {
  const answerTokens = normalizedTokens(answerText);
  if (!answerTokens.size) return false;
  const feedbackTokens = normalizedTokens(feedback);
  const overlap = [...answerTokens].filter((token) => feedbackTokens.has(token)).length;
  return overlap >= Math.min(3, answerTokens.size);
}

function extractAnswerEvidence(answerText: string) {
  const cleaned = answerText.replace(/\s+/g, " ").trim();
  if (!cleaned) return "chưa có nội dung cụ thể";
  const firstSentence = cleaned.split(/[.!?。！？]/u)[0]?.trim() || cleaned;
  return firstSentence.length > 100 ? `${firstSentence.slice(0, 97)}...` : firstSentence;
}

function addEvidenceToGenericItems(values: string[], evidence: string, language: LanguageCode) {
  return values.map((value) => {
    if (value.length >= 35) return value;
    return localized(
      language,
      `${value}: thể hiện qua ý “${evidence}”.`,
      `${value}: shown by “${evidence}”.`,
      `${value}：体现在“${evidence}”。`
    );
  });
}

function normalizedTokens(text: string) {
  return new Set(
    text.toLocaleLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 4)
  );
}

function localized(language: LanguageCode, vi: string, en: string, zh: string) {
  return language === LanguageCode.EN ? en : language === LanguageCode.ZH ? zh : vi;
}
