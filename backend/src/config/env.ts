import dotenv from "dotenv";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";

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
  openAiTtsModel: process.env.OPENAI_TTS_MODEL ?? (process.env.OPENAI_BASE_URL?.includes("beeknoee") ? "openai/gpt-4o-mini-tts" : "tts-1"),
  port: Number(process.env.BACKEND_PORT ?? 4000),
  redisUrl: process.env.REDIS_URL,
  azureSpeechKey: process.env.AZURE_SPEECH_KEY,
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION ?? "eastasia",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET
};
