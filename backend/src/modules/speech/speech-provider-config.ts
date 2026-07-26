export type SpeechProviderEnvironment = {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  SPEECH_API_KEY?: string;
  SPEECH_BASE_URL?: string;
  SPEECH_STT_MODEL?: string;
  SPEECH_TTS_MODEL?: string;
};

export type SpeechProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  sttModel: string;
  ttsModel: string;
};

function clean(value: string | undefined) {
  return value?.trim() || undefined;
}

function isBeeknoeeUrl(value: string | undefined) {
  return value?.toLowerCase().includes("beeknoee") ?? false;
}

/**
 * Speech dùng credential riêng để không vô tình đi qua provider AI văn bản.
 * Chỉ giữ tương thích cấu hình OPENAI_* cũ khi endpoint đó không phải Beeknoee.
 */
export function resolveSpeechProviderConfig(
  source: SpeechProviderEnvironment
): SpeechProviderConfig {
  const explicitApiKey = clean(source.SPEECH_API_KEY);
  const explicitBaseUrl = clean(source.SPEECH_BASE_URL);
  const legacyBaseUrl = clean(source.OPENAI_BASE_URL);
  const canUseLegacyOpenAi = !explicitApiKey
    && !explicitBaseUrl
    && !isBeeknoeeUrl(legacyBaseUrl);

  return {
    apiKey: explicitApiKey || (canUseLegacyOpenAi ? clean(source.OPENAI_API_KEY) : undefined),
    baseUrl: explicitBaseUrl || (canUseLegacyOpenAi ? legacyBaseUrl : undefined),
    sttModel: clean(source.SPEECH_STT_MODEL) || "gpt-4o-transcribe",
    ttsModel: clean(source.SPEECH_TTS_MODEL) || "gpt-4o-mini-tts"
  };
}

