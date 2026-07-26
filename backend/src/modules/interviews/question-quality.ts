import { LanguageCode } from "@prisma/client";
import { normalizeSearchText } from "../../utils/search-normalize.js";

const majorFamilies = [
  ["thương mại điện tử", "e-commerce", "ecommerce", "电子商务"],
  ["quan hệ quốc tế", "international relations", "国际关系", "ngoại giao", "diplomacy", "外交"],
  ["khoa học máy tính", "computer science", "计算机科学", "lập trình", "programming", "thuật toán", "algorithm"],
  ["kiến trúc", "architecture", "建筑学"]
];

export type QuestionValidationInput = {
  askedQuestions?: string[];
  language: LanguageCode;
  questionText: string;
  ragContext?: string | null;
  targetMajor?: string | null;
  unrelatedMajorAliases?: string[];
};

export type QuestionValidationResult = {
  reasons: Array<"DUPLICATE" | "GENERIC" | "LANGUAGE_MISMATCH" | "UNRELATED_MAJOR" | "UNSUPPORTED_SCHOOL_FACT">;
  valid: boolean;
};

export function validateInterviewQuestion(input: QuestionValidationInput): QuestionValidationResult {
  const reasons: QuestionValidationResult["reasons"] = [];

  if (!isQuestionLanguageCompatible(input.questionText, input.language)) {
    reasons.push("LANGUAGE_MISMATCH");
  }
  if ((input.askedQuestions ?? []).some((asked) => areNearDuplicateQuestions(asked, input.questionText))) {
    reasons.push("DUPLICATE");
  }
  if (mentionsUnrelatedMajor(input.questionText, input.targetMajor, input.unrelatedMajorAliases ?? [])) {
    reasons.push("UNRELATED_MAJOR");
  }
  if (isOverlyGenericQuestion(input.questionText)) {
    reasons.push("GENERIC");
  }
  if (mentionsUnsupportedSchoolFact(input.questionText, input.ragContext)) {
    reasons.push("UNSUPPORTED_SCHOOL_FACT");
  }

  return { reasons, valid: reasons.length === 0 };
}

export function isOverlyGenericQuestion(text: string) {
  const normalized = normalizeSearchText(text);
  const hasHan = /[\u3400-\u9fff]/u.test(text);
  const tokens = normalized.split(" ").filter(Boolean);
  if (hasHan ? text.replace(/\s+/g, "").length < 8 : tokens.length < 5) return true;
  return [
    "ban co the noi ro hon khong",
    "ban co the chia se them khong",
    "can you elaborate",
    "can you tell me more",
    "what else would you like to add",
    "你能详细说说吗",
    "你还有什么想补充"
  ].some((pattern) => normalized.includes(normalizeSearchText(pattern)))
    && !/["“”'「」]/u.test(text);
}

export function mentionsUnsupportedSchoolFact(questionText: string, ragContext?: string | null) {
  const factualClaims = questionText.match(
    /[^。.!?]*(?:giáo sư|phòng thí nghiệm|xếp hạng|top\s*\d+|professor|laboratory|research lab|ranked|教授|实验室|排名)[^。.!?]*/giu
  ) ?? [];
  if (!factualClaims.length) return false;
  const normalizedContext = normalizeSearchText(ragContext ?? "");
  if (!normalizedContext) return true;
  return factualClaims.some((claim) => {
    const meaningfulTokens = normalizeSearchText(claim)
      .split(" ")
      .filter((token) => token.length >= 5);
    return meaningfulTokens.length > 0
      && meaningfulTokens.filter((token) => normalizedContext.includes(token)).length < Math.min(2, meaningfulTokens.length);
  });
}

export function isQuestionLanguageCompatible(text: string, language: LanguageCode) {
  const compact = text.trim();
  if (!compact) return false;
  const hasHan = /[\u3400-\u9fff]/u.test(compact);
  const hasVietnamese = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(compact);
  const looksEnglish = /\b(the|your|you|what|why|how|please|study|major|university|scholarship)\b/i.test(compact);

  if (language === LanguageCode.ZH) return hasHan;
  if (language === LanguageCode.EN) return !hasHan && !hasVietnamese;
  return !hasHan && !looksEnglish;
}

export function areNearDuplicateQuestions(left: string, right: string) {
  const normalizedLeft = normalizeSearchText(left);
  const normalizedRight = normalizeSearchText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = new Set(normalizedLeft.split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(normalizedRight.split(" ").filter((token) => token.length > 2));
  if (!leftTokens.size || !rightTokens.size) return false;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return overlap / union >= 0.78;
}

export function mentionsUnrelatedMajor(
  questionText: string,
  targetMajor?: string | null,
  additionalAliases: string[] = []
) {
  const normalizedQuestion = normalizeSearchText(questionText);
  const normalizedTarget = normalizeSearchText(targetMajor ?? "");
  const targetFamily = majorFamilies.find((family) =>
    family.some((alias) => normalizedTarget.includes(normalizeSearchText(alias)))
  );
  const forbiddenAliases = [
    ...additionalAliases,
    ...majorFamilies
      .filter((family) => family !== targetFamily)
      .flat()
  ];

  return forbiddenAliases.some((alias) => {
    const normalizedAlias = normalizeSearchText(alias);
    return normalizedAlias.length >= 4 && normalizedQuestion.includes(normalizedAlias);
  });
}
