import { describe, expect, it } from "vitest";
import { resolveSpeechProviderConfig } from "./speech-provider-config.js";

describe("resolveSpeechProviderConfig", () => {
  it("không dùng nhầm Beeknoee cho nhận dạng giọng nói", () => {
    const config = resolveSpeechProviderConfig({
      OPENAI_API_KEY: "beeknoee-key",
      OPENAI_BASE_URL: "https://platform.beeknoee.com/api/v1"
    });

    expect(config.apiKey).toBeUndefined();
    expect(config.baseUrl).toBeUndefined();
  });

  it("ưu tiên cấu hình speech độc lập", () => {
    const config = resolveSpeechProviderConfig({
      OPENAI_API_KEY: "text-ai-key",
      OPENAI_BASE_URL: "https://platform.beeknoee.com/api/v1",
      SPEECH_API_KEY: "speech-key",
      SPEECH_BASE_URL: "https://api.openai.com/v1",
      SPEECH_STT_MODEL: "whisper-1"
    });

    expect(config).toMatchObject({
      apiKey: "speech-key",
      baseUrl: "https://api.openai.com/v1",
      sttModel: "whisper-1"
    });
  });

  it("giữ tương thích endpoint OpenAI cũ không phải Beeknoee", () => {
    const config = resolveSpeechProviderConfig({
      OPENAI_API_KEY: "legacy-key",
      OPENAI_BASE_URL: "https://api.openai.com/v1"
    });

    expect(config.apiKey).toBe("legacy-key");
    expect(config.baseUrl).toBe("https://api.openai.com/v1");
  });
});

