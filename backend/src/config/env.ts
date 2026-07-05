import dotenv from "dotenv";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";
const usesOpenAiNamespace = process.env.OPENAI_BASE_URL?.includes("beeknoee");

export const openAiTtsVoiceOptions = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse"
] as const;

export type OpenAiTtsVoice = typeof openAiTtsVoiceOptions[number];

export type AiModelCostEntry = {
  inputCostPer1M?: number | null;
  outputCostPer1M?: number | null;
};

export type AiModelCosts = Record<string, AiModelCostEntry>;

function defaultOpenAiProviderModel(model: string) {
  return usesOpenAiNamespace ? `openai/${model}` : model;
}

function optionalOpenAiTtsVoice(value: string | undefined): OpenAiTtsVoice {
  return openAiTtsVoiceOptions.includes(value as OpenAiTtsVoice) ? (value as OpenAiTtsVoice) : "nova";
}

// Require JWT_SECRET in production - no weak defaults
const jwtSecret = process.env.JWT_SECRET;
if (isProd && (!jwtSecret || jwtSecret === "change_me_in_development")) {
  throw new Error("JWT_SECRET phải được thiết lập trong môi trường production");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL chưa được thiết lập");
}

function optionalNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalCostNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCostKey(value: string) {
  return value.trim().toLowerCase();
}

function parseModelCostEntry(value: unknown): AiModelCostEntry | null {
  if (!isRecord(value)) return null;

  const inputCostPer1M =
    optionalCostNumber(value.inputCostPer1M)
    ?? optionalCostNumber(value.input_cost_per_1m)
    ?? optionalCostNumber(value.input)
    ?? optionalCostNumber(value.promptCostPer1M)
    ?? optionalCostNumber(value.prompt_cost_per_1m);
  const outputCostPer1M =
    optionalCostNumber(value.outputCostPer1M)
    ?? optionalCostNumber(value.output_cost_per_1m)
    ?? optionalCostNumber(value.output)
    ?? optionalCostNumber(value.completionCostPer1M)
    ?? optionalCostNumber(value.completion_cost_per_1m);

  if (inputCostPer1M == null && outputCostPer1M == null) return null;
  return { inputCostPer1M, outputCostPer1M };
}

function addModelCost(costs: AiModelCosts, key: string, value: unknown) {
  const entry = parseModelCostEntry(value);
  if (!entry) return;
  costs[normalizeCostKey(key)] = entry;
}

function parseAiModelCostsJson(value: string | undefined): AiModelCosts {
  const costs: AiModelCosts = {};
  if (!value?.trim()) return costs;

  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!isRecord(item)) continue;
        const provider = readString(item.provider);
        const model = readString(item.model);
        if (!provider || !model) continue;
        addModelCost(costs, `${provider}/${model}`, item);
      }
      return costs;
    }

    if (!isRecord(parsed)) return costs;

    for (const [key, config] of Object.entries(parsed)) {
      const directEntry = parseModelCostEntry(config);
      if (directEntry) {
        costs[normalizeCostKey(key)] = directEntry;
        continue;
      }

      if (!isRecord(config)) continue;
      for (const [model, modelConfig] of Object.entries(config)) {
        addModelCost(costs, `${key}/${model}`, modelConfig);
      }
    }
  } catch {
    console.warn("[AI] AI_MODEL_COSTS_JSON is invalid; model cost overrides disabled");
  }

  return costs;
}

function parseFrontendUrls() {
  const configured = process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? "http://localhost:3010";
  const urls = configured
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (!isProd) {
    urls.push("http://localhost:3000", "http://localhost:3010", "http://127.0.0.1:3000", "http://127.0.0.1:3010");
  }

  return Array.from(new Set(urls));
}

const frontendUrls = parseFrontendUrls();

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: frontendUrls[0] ?? "http://localhost:3010",
  frontendUrls,
  isProd,
  jwtSecret: jwtSecret ?? "change_me_in_development",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiBaseUrl: process.env.OPENAI_BASE_URL,
  aiModelCosts: parseAiModelCostsJson(process.env.AI_MODEL_COSTS_JSON),
  openAiInputCostPer1M: optionalNumber(process.env.OPENAI_INPUT_COST_PER_1M),
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openAiOutputCostPer1M: optionalNumber(process.env.OPENAI_OUTPUT_COST_PER_1M),
  openAiSttModel: process.env.OPENAI_STT_MODEL?.trim() || defaultOpenAiProviderModel("gpt-4o-transcribe"),
  openAiTtsModel: process.env.OPENAI_TTS_MODEL?.trim() || defaultOpenAiProviderModel("gpt-4o-mini-tts"),
  openAiTtsVoice: optionalOpenAiTtsVoice(process.env.OPENAI_TTS_VOICE),
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL,
  bankAccountName: process.env.BANK_ACCOUNT_NAME,
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER,
  bankCode: process.env.BANK_CODE,
  sepayWebhookApiKey: process.env.SEPAY_WEBHOOK_API_KEY,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL,
  openRouterModel: process.env.OPENROUTER_MODEL,
  nineRouterApiKey: process.env.NINEROUTER_API_KEY,
  nineRouterBaseUrl: process.env.NINEROUTER_BASE_URL,
  nineRouterModel: process.env.NINEROUTER_MODEL,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL,
  deepseekFlashModel: process.env.DEEPSEEK_FLASH_MODEL ?? process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
  deepseekProModel: process.env.DEEPSEEK_PRO_MODEL ?? "deepseek-v4-pro",
  port: Number(process.env.BACKEND_PORT ?? 4000),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? "35mb",
  redisUrl: process.env.REDIS_URL,
  azureSpeechKey: process.env.AZURE_SPEECH_KEY,
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION ?? "eastasia",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  r2Bucket: process.env.R2_BUCKET ?? process.env.R2_BUCKET_NAME,
  r2Endpoint: process.env.R2_ENDPOINT,
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  r2Region: process.env.R2_REGION ?? "auto"
};
