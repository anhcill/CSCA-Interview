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
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET
};
