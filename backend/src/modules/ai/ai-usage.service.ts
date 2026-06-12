import { type Prisma, type ai_task_type } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";

export type AiTokenUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type AiUsageLogInput = {
  errorMessage?: string | null;
  latencyMs?: number | null;
  model?: string | null;
  promptTemplateId?: string | null;
  provider: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  taskType: ai_task_type;
  tokenUsage?: AiTokenUsage | null;
  userId?: string | null;
};

export async function logAiUsage(input: AiUsageLogInput) {
  try {
    await prisma.ai_usage_logs.create({
      data: {
        cost_usd: estimateCostUsd(input.tokenUsage) ?? null,
        error_message: input.errorMessage ?? null,
        input_tokens: input.tokenUsage?.inputTokens ?? null,
        latency_ms: input.latencyMs ?? null,
        model: input.model ?? null,
        output_tokens: input.tokenUsage?.outputTokens ?? null,
        prompt_template_id: input.promptTemplateId ?? null,
        provider: input.provider,
        request_payload: toJson(input.requestPayload),
        response_payload: toJson(input.responsePayload),
        task_type: input.taskType,
        total_tokens: input.tokenUsage?.totalTokens ?? null,
        user_id: input.userId ?? null
      }
    });
  } catch (error) {
    console.warn("[AI] usage log failed", error instanceof Error ? error.message : error);
  }
}

export function extractOpenAiTokenUsage(usage: unknown): AiTokenUsage | null {
  if (!usage || typeof usage !== "object") return null;
  const data = usage as Record<string, unknown>;
  const inputTokens = readNumber(data.prompt_tokens) ?? readNumber(data.input_tokens);
  const outputTokens = readNumber(data.completion_tokens) ?? readNumber(data.output_tokens);
  const totalTokens = readNumber(data.total_tokens) ?? (
    inputTokens != null || outputTokens != null ? (inputTokens ?? 0) + (outputTokens ?? 0) : null
  );

  if (inputTokens == null && outputTokens == null && totalTokens == null) return null;
  return { inputTokens, outputTokens, totalTokens };
}

function estimateCostUsd(usage?: AiTokenUsage | null) {
  if (!usage?.inputTokens || !usage.outputTokens) return null;
  if (env.openAiInputCostPer1M == null || env.openAiOutputCostPer1M == null) return null;

  const cost = (
    usage.inputTokens * env.openAiInputCostPer1M
    + usage.outputTokens * env.openAiOutputCostPer1M
  ) / 1_000_000;

  return Number(cost.toFixed(6));
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
