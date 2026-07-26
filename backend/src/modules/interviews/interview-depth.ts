export type InterviewDepthStrategy =
  | "CLARIFY_AND_EXAMPLE"
  | "ROLE_METHOD_RESULT"
  | "CHALLENGE_RISK_BACKUP";

export type InterviewDepthAnalysis = {
  candidateClaims: string[];
  currentDepth: 1 | 2 | 3;
  hasEnoughEvidence: boolean;
  missingContent: string[];
  strategy: InterviewDepthStrategy;
};

const evidencePatterns = {
  example: /ví dụ|dự án|kinh nghiệm|trường hợp|example|project|experience|例如|项目|经历/iu,
  method: /phương pháp|cách thực hiện|quy trình|method|approach|process|方法|步骤/iu,
  number: /\b\d+(?:[.,]\d+)?%?\b/u,
  result: /kết quả|đạt được|cải thiện|result|outcome|improved|结果|成果|提升/iu,
  role: /vai trò|chịu trách nhiệm|tôi phụ trách|role|responsible|led|角色|负责/iu
};

export function analyzeInterviewDepth(input: {
  answerText: string;
  requestedDepth: number;
}): InterviewDepthAnalysis {
  const answer = input.answerText.replace(/\s+/g, " ").trim();
  const missingContent: string[] = [];

  if (!evidencePatterns.example.test(answer)) missingContent.push("ví dụ hoặc trải nghiệm cụ thể");
  if (!evidencePatterns.role.test(answer)) missingContent.push("vai trò cá nhân");
  if (!evidencePatterns.method.test(answer)) missingContent.push("phương pháp thực hiện");
  if (!evidencePatterns.result.test(answer)) missingContent.push("kết quả đạt được");
  if (!evidencePatterns.number.test(answer)) missingContent.push("số liệu hoặc mốc đo lường");

  const evidenceCount = 5 - missingContent.length;
  const currentDepth = Math.max(1, Math.min(3, Math.floor(input.requestedDepth))) as 1 | 2 | 3;

  return {
    candidateClaims: extractCandidateClaims(answer),
    currentDepth,
    hasEnoughEvidence: evidenceCount >= 3,
    missingContent,
    strategy: currentDepth === 1
      ? "CLARIFY_AND_EXAMPLE"
      : currentDepth === 2
        ? "ROLE_METHOD_RESULT"
        : "CHALLENGE_RISK_BACKUP"
  };
}

export function extractCandidateClaims(answerText: string) {
  return answerText
    .split(/(?<=[.!?。！？])\s+|[;；]\s*/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12)
    .slice(0, 5);
}

export function shouldSwitchInterviewTopic(input: {
  consecutiveWeakAnswers: number;
  currentDepth: number;
  hasEnoughEvidence: boolean;
  remainingMinutes: number;
  requiredTopicsRemaining: number;
}) {
  if (input.consecutiveWeakAnswers >= 2) return true;
  if (input.currentDepth >= 2 && input.hasEnoughEvidence) return true;
  return input.requiredTopicsRemaining > 0
    && input.remainingMinutes <= input.requiredTopicsRemaining * 3;
}
