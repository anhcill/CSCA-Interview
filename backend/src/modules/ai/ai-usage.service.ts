import { type Prisma, type ai_task_type } from "@prisma/client";
import { env, type AiModelCostEntry } from "../../config/env.js";
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
    const log = await prisma.ai_usage_logs.create({
      data: {
        cost_usd: estimateCostUsd(input.provider, input.model, input.tokenUsage) ?? null,
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
      },
      select: { id: true }
    });
    return log.id;
  } catch (error) {
    console.warn("[AI] usage log failed", error instanceof Error ? error.message : error);
    return null;
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

function estimateCostUsd(provider: string, model?: string | null, usage?: AiTokenUsage | null) {
  if (!usage) return null;

  const modelCost = resolveModelCost(provider, model);
  if (!modelCost) return null;

  let cost = 0;
  let hasPricedUsage = false;

  if (usage.inputTokens != null && modelCost.inputCostPer1M != null) {
    cost += usage.inputTokens * modelCost.inputCostPer1M;
    hasPricedUsage = true;
  }

  if (usage.outputTokens != null && modelCost.outputCostPer1M != null) {
    cost += usage.outputTokens * modelCost.outputCostPer1M;
    hasPricedUsage = true;
  }

  if (!hasPricedUsage) return null;
  return Number((cost / 1_000_000).toFixed(6));
}

function resolveModelCost(provider: string, model?: string | null): AiModelCostEntry | null {
  const configuredCost = findConfiguredModelCost(provider, model);
  if (configuredCost) return configuredCost;

  if (!isOpenAiProvider(provider)) return null;
  if (env.openAiInputCostPer1M == null && env.openAiOutputCostPer1M == null) return null;

  return {
    inputCostPer1M: env.openAiInputCostPer1M,
    outputCostPer1M: env.openAiOutputCostPer1M
  };
}

function findConfiguredModelCost(provider: string, model?: string | null): AiModelCostEntry | null {
  const modelKey = normalizeCostKey(model);
  if (!modelKey) return null;

  const providerKeys = providerCostAliases(provider);
  const candidates = new Set<string>();

  for (const providerKey of providerKeys) {
    const modelWithoutProvider = stripProviderPrefix(modelKey, providerKeys);
    candidates.add(`${providerKey}/${modelKey}`);
    candidates.add(`${providerKey}/${modelWithoutProvider}`);
    candidates.add(`${providerKey}:${modelWithoutProvider}`);

    if (providerKey === "openai") {
      candidates.add(modelKey);
      candidates.add(modelWithoutProvider);
    }
  }

  for (const candidate of candidates) {
    const cost = env.aiModelCosts[candidate];
    if (cost) return cost;
  }

  return null;
}

function providerCostAliases(provider: string) {
  const normalized = normalizeProviderForCost(provider);
  return normalized === "9router" ? ["9router", "ninerouter"] : [normalized];
}

function normalizeProviderForCost(provider: string) {
  const normalized = provider.trim().toLowerCase().replace(/[_\s-]/g, "");
  return normalized === "ninerouter" ? "9router" : normalized;
}

function normalizeCostKey(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function stripProviderPrefix(modelKey: string, providerKeys: string[]) {
  for (const providerKey of providerKeys) {
    const slashPrefix = `${providerKey}/`;
    if (modelKey.startsWith(slashPrefix)) return modelKey.slice(slashPrefix.length);

    const colonPrefix = `${providerKey}:`;
    if (modelKey.startsWith(colonPrefix)) return modelKey.slice(colonPrefix.length);
  }
  return modelKey;
}

function isOpenAiProvider(provider: string) {
  return normalizeProviderForCost(provider) === "openai";
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
