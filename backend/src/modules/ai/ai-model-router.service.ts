import { ai_task_type, type Prisma } from "@prisma/client";
import OpenAI from "openai";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";

export const aiModelRouterSettingKey = "ai_model_router";

export type AiProviderId = "deepseek" | "openai" | "openrouter" | "9router";

type RouteCandidate = {
  baseUrl?: string | null;
  model?: string | null;
  provider?: AiProviderId | null;
  source: string;
};

export type AiModelRouteInput = {
  agentKey?: string | null;
  operation: string;
  taskType: ai_task_type;
};

export type ResolvedAiModelRoute = {
  client: OpenAI | null;
  errorMessage?: string;
  model: string | null;
  provider: AiProviderId | "fallback";
  source: string;
};

const clientCache = new Map<string, OpenAI>();

export const aiModelRouterAgents = [
  {
    description: "Tạo bộ câu hỏi ban đầu theo hồ sơ, trường, ngành và học bổng.",
    key: "interview_question_generator",
    label: "AI tạo câu hỏi"
  },
  {
    description: "Chọn câu hỏi tiếp theo dựa trên câu trả lời gần nhất.",
    key: "adaptive_follow_up_generator",
    label: "AI hỏi tiếp"
  },
  {
    description: "Chấm điểm nội dung, logic, ngôn ngữ và góp ý cải thiện.",
    key: "answer_scoring_evaluator",
    label: "AI chấm điểm"
  },
  {
    description: "Đọc và phân tích Study Plan, trích điểm mạnh/yếu và sinh câu hỏi.",
    key: "study_plan_analyzer",
    label: "AI phân tích Study Plan"
  }
] as const;

export const aiModelProviderOptions = [
  { id: "9router", label: "9Router" },
  { id: "openai", label: "OpenAI" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "openrouter", label: "OpenRouter" }
] as const satisfies Array<{ id: AiProviderId; label: string }>;

export const aiModelPresetOptions = [
  { model: "cx/gpt-5.5", provider: "9router", label: "CX GPT-5.5", tier: "Mạnh, ưu tiên test miễn phí" },
  { model: "cx/gpt-5.5-review", provider: "9router", label: "CX GPT-5.5 Review", tier: "Mạnh cho review/chấm kỹ" },
  { model: "cx/gpt-5.4", provider: "9router", label: "CX GPT-5.4", tier: "Cân bằng" },
  { model: "cx/gpt-5.4-review", provider: "9router", label: "CX GPT-5.4 Review", tier: "Cân bằng cho review" },
  { model: "cx/gpt-5.4-mini", provider: "9router", label: "CX GPT-5.4 Mini", tier: "Nhanh hơn" },
  { model: "cx/gpt-5.4-mini-review", provider: "9router", label: "CX GPT-5.4 Mini Review", tier: "Nhanh hơn cho review" },
  { model: "ag/claude-sonnet-4-6", provider: "9router", label: "Claude Sonnet 4.6", tier: "Mạnh, diễn giải tốt" },
  { model: "ag/claude-opus-4-6-thinking", provider: "9router", label: "Claude Opus 4.6 Thinking", tier: "Rất mạnh, suy luận sâu" },
  { model: "gpt-4o-mini", provider: "openai", label: "OpenAI GPT-4o mini", tier: "Fallback trả phí rẻ" },
  { model: "gpt-4o", provider: "openai", label: "OpenAI GPT-4o", tier: "Fallback trả phí ổn định" },
  { model: "gpt-4.1", provider: "openai", label: "OpenAI GPT-4.1", tier: "Fallback trả phí mạnh" }
] as const satisfies Array<{ label: string; model: string; provider: AiProviderId; tier: string }>;

export async function resolveAiModelRoute(input: AiModelRouteInput): Promise<ResolvedAiModelRoute> {
  return (await resolveAiModelRoutes(input))[0] ?? {
    client: null,
    errorMessage: "No AI model route configured",
    model: null,
    provider: "fallback",
    source: "fallback"
  };
}

export async function resolveAiModelRoutes(input: AiModelRouteInput): Promise<ResolvedAiModelRoute[]> {
  const settings = await readRouterSettings();
  const candidates = [
    ...collectSettingsCandidates(settings, input),
    ...collectEnvFallbackCandidates(input.taskType)
  ];
  const routes: ResolvedAiModelRoute[] = [];
  const skipped: string[] = [];

  for (const candidate of candidates) {
    const provider = candidate.provider ?? primaryConfiguredProvider();
    if (!provider) {
      skipped.push(`${candidate.source}: provider missing`);
      continue;
    }

    const model = candidate.model ?? defaultModelForProvider(provider, input.taskType);
    if (!model) {
      skipped.push(`${candidate.source}: model missing for ${provider}`);
      continue;
    }

    const apiKey = apiKeyForProvider(provider);
    if (!apiKey) {
      skipped.push(`${candidate.source}: API key missing for ${provider}`);
      continue;
    }

    const baseUrl = candidate.baseUrl
      ?? providerBaseUrlFromSettings(settings, provider)
      ?? defaultBaseUrlForProvider(provider);
    if (requiresBaseUrl(provider) && !baseUrl) {
      skipped.push(`${candidate.source}: baseUrl missing for ${provider}`);
      continue;
    }

    routes.push({
      client: getClient(provider, apiKey, baseUrl),
      model,
      provider,
      source: candidate.source
    });
  }

  if (routes.length) return dedupeRoutes(routes);

  return [{
    client: null,
    errorMessage: skipped.length ? `No usable AI model route found (${skipped.join("; ")})` : "No AI model route configured",
    model: null,
    provider: "fallback",
    source: "fallback"
  }];
}

async function readRouterSettings(): Promise<Record<string, unknown> | null> {
  try {
    const setting = await prisma.system_settings.findUnique({
      select: { setting_value: true },
      where: { setting_key: aiModelRouterSettingKey }
    });
    return isRecord(setting?.setting_value) ? setting.setting_value : null;
  } catch (error) {
    console.warn("[AI] model router settings unavailable", error instanceof Error ? error.message : error);
    return null;
  }
}

function collectSettingsCandidates(
  settings: Record<string, unknown> | null,
  input: AiModelRouteInput
): RouteCandidate[] {
  if (!settings) return [];

  const candidates: RouteCandidate[] = [];
  if (input.agentKey) {
    pushRoute(candidates, scopedValue(settings, ["agents", "agentKeys"], input.agentKey), `setting:agent:${input.agentKey}`);
  }
  pushRoute(candidates, scopedValue(settings, ["operations", "operation"], input.operation), `setting:operation:${input.operation}`);
  pushRoute(candidates, scopedValue(settings, ["taskTypes", "tasks", "task_type"], input.taskType), `setting:taskType:${input.taskType}`);
  pushRoute(candidates, settings.default ?? settings.defaultRoute, "setting:default");
  return candidates;
}

function collectEnvFallbackCandidates(taskType: ai_task_type): RouteCandidate[] {
  const deepseekModel = defaultModelForProvider("deepseek", taskType);
  return [
    { model: env.nineRouterModel, provider: "9router", source: "env:9router" },
    { model: deepseekModel, provider: "deepseek", source: "env:deepseek" },
    { model: env.openRouterModel, provider: "openrouter", source: "env:openrouter" },
    { model: env.openAiModel, provider: "openai", source: "env:openai" }
  ];
}

function pushRoute(candidates: RouteCandidate[], value: unknown, source: string) {
  const route = normalizeRoute(value, source);
  if (route) candidates.push(route);
}

function scopedValue(settings: Record<string, unknown>, scopeNames: string[], key: string) {
  for (const scopeName of scopeNames) {
    const scope = settings[scopeName];
    if (!isRecord(scope)) continue;
    const direct = scope[key];
    if (direct !== undefined) return direct;
    const lowerKey = key.toLowerCase();
    const matchedKey = Object.keys(scope).find((candidate) => candidate.toLowerCase() === lowerKey);
    if (matchedKey) return scope[matchedKey];
  }
  return undefined;
}

function normalizeRoute(value: unknown, source: string): RouteCandidate | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const [providerText, ...modelParts] = trimmed.split(":");
    const provider = normalizeProvider(providerText);
    if (provider && modelParts.length > 0) {
      return { model: modelParts.join(":").trim() || null, provider, source };
    }
    if (provider) return { provider, source };
    return { model: trimmed, source };
  }

  if (!isRecord(value)) return null;

  const provider = normalizeProvider(readString(value.provider));
  const model = readString(value.model) ?? readString(value.modelName);
  const baseUrl = readString(value.baseUrl) ?? readString(value.baseURL);
  if (!provider && !model && !baseUrl) return null;

  return { baseUrl, model, provider, source };
}

function providerBaseUrlFromSettings(settings: Record<string, unknown> | null, provider: AiProviderId) {
  if (!settings) return null;
  const providers = settings.providers;
  if (!isRecord(providers)) return null;
  const config = providers[provider] ?? (provider === "9router" ? providers.ninerouter : undefined);
  if (!isRecord(config)) return null;
  return readString(config.baseUrl) ?? readString(config.baseURL);
}

function normalizeProvider(value: unknown): AiProviderId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[_\s-]/g, "");
  if (normalized === "deepseek") return "deepseek";
  if (normalized === "openai") return "openai";
  if (normalized === "openrouter") return "openrouter";
  if (normalized === "9router" || normalized === "ninerouter") return "9router";
  return null;
}

function primaryConfiguredProvider(): AiProviderId | null {
  if (env.nineRouterApiKey) return "9router";
  if (env.deepseekApiKey) return "deepseek";
  if (env.openRouterApiKey) return "openrouter";
  if (env.openAiApiKey) return "openai";
  return null;
}

function apiKeyForProvider(provider: AiProviderId) {
  if (provider === "deepseek") return env.deepseekApiKey;
  if (provider === "openai") return env.openAiApiKey;
  if (provider === "openrouter") return env.openRouterApiKey;
  return env.nineRouterApiKey;
}

function defaultModelForProvider(provider: AiProviderId, taskType: ai_task_type) {
  if (provider === "deepseek") {
    const isProTask = taskType === ai_task_type.SCORE_ANSWER || taskType === ai_task_type.ANALYZE_STUDY_PLAN;
    return isProTask ? env.deepseekProModel : env.deepseekFlashModel;
  }
  if (provider === "openai") return env.openAiModel;
  if (provider === "openrouter") return env.openRouterModel;
  return env.nineRouterModel;
}

function defaultBaseUrlForProvider(provider: AiProviderId) {
  if (provider === "deepseek") return env.deepseekBaseUrl || "https://api.deepseek.com/v1";
  if (provider === "openai") return env.openAiBaseUrl ?? null;
  if (provider === "openrouter") return env.openRouterBaseUrl || "https://openrouter.ai/api/v1";
  return env.nineRouterBaseUrl ?? null;
}

function requiresBaseUrl(provider: AiProviderId) {
  return provider === "9router";
}

function getClient(provider: AiProviderId, apiKey: string, baseUrl?: string | null) {
  const cacheKey = `${provider}:${baseUrl ?? "default"}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = new OpenAI({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {})
  });
  clientCache.set(cacheKey, client);
  return client;
}

function dedupeRoutes(routes: ResolvedAiModelRoute[]) {
  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = `${route.provider}:${route.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function testAiModelRoute(input: {
  baseUrl?: string | null;
  model: string;
  provider: AiProviderId;
}) {
  const apiKey = apiKeyForProvider(input.provider);
  if (!apiKey) {
    return {
      ok: false,
      message: `Chưa cấu hình API key cho ${input.provider}`,
      model: input.model,
      provider: input.provider
    };
  }

  const baseUrl = input.baseUrl ?? defaultBaseUrlForProvider(input.provider);
  if (requiresBaseUrl(input.provider) && !baseUrl) {
    return {
      ok: false,
      message: `Chưa cấu hình base URL cho ${input.provider}`,
      model: input.model,
      provider: input.provider
    };
  }

  const startedAt = Date.now();
  try {
    const response = await getClient(input.provider, apiKey, baseUrl).chat.completions.create({
      messages: [
        { role: "system", content: "Return strict JSON only." },
        { role: "user", content: "Return {\"ok\":true}." }
      ],
      model: input.model,
      response_format: { type: "json_object" },
      temperature: 0
    });
    const content = response.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject(content);
    return {
      content: content.slice(0, 200),
      latencyMs: Date.now() - startedAt,
      model: input.model,
      ok: Boolean(parsed),
      provider: input.provider,
      message: parsed ? "Model phản hồi JSON hợp lệ." : "Model phản hồi nhưng không trả JSON hợp lệ."
    };
  } catch (error) {
    return {
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
      model: input.model,
      ok: false,
      provider: input.provider
    };
  }
}

function parseJsonObject(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const jsonText = fenced ?? trimmed;

  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    const first = jsonText.indexOf("{");
    const last = jsonText.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;
    try {
      return JSON.parse(jsonText.slice(first, last + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type AiModelRouterSettingValue = Prisma.JsonObject;
