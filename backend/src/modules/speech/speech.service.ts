import fs from "fs";
import path from "path";
import os from "os";
import OpenAI from "openai";
import { env } from "../../config/env.js";

const openai = env.openAiApiKey
  ? new OpenAI({
      apiKey: env.openAiApiKey,
      ...(env.openAiBaseUrl ? { baseURL: env.openAiBaseUrl } : {})
    })
  : null;

export class MissingOpenAiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY chưa được cấu hình. Tính năng AI speech trên server đang tắt; phỏng vấn text vẫn dùng fallback local.");
    this.name = "MissingOpenAiKeyError";
  }
}

function requireOpenAi() {
  if (!openai) throw new MissingOpenAiKeyError();
  return openai;
}

export type TranscribeResult = {
  text: string;
  language: string;
  duration?: number;
};

export type SynthesizeResult = {
  audioBuffer: Buffer;
  contentType: string;
};

/**
 * Transcribe audio using OpenAI Whisper API.
 * Accepts a base64-encoded audio string + mime type.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = "audio/webm",
  language?: string
): Promise<TranscribeResult> {
  const client = requireOpenAi();

  // Write base64 to temp file (Whisper API needs a file)
  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "webm";
  const tmpFile = path.join(os.tmpdir(), `speech_${Date.now()}.${ext}`);

  try {
    const buffer = Buffer.from(audioBase64, "base64");

    // Limit: 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error("File audio quá lớn (tối đa 10MB)");
    }

    fs.writeFileSync(tmpFile, buffer);

    const startedAt = Date.now();
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: "whisper-1",
      ...(language ? { language } : {}),
      response_format: "verbose_json"
    });
    console.log(`[AI] whisper.transcribe ${Date.now() - startedAt}ms`);

    return {
      text: transcription.text,
      language: transcription.language ?? language ?? "unknown",
      duration: transcription.duration ?? undefined
    };
  } finally {
    // Cleanup temp file
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Synthesize text to speech using OpenAI TTS API.
 */
export async function synthesizeSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova",
  speed: number = 1.0
): Promise<SynthesizeResult> {
  const client = requireOpenAi();

  if (!text.trim()) {
    throw new Error("Text không được để trống");
  }

  // Limit text length to prevent abuse (max ~4096 chars)
  const trimmedText = text.slice(0, 4096);

  const startedAt = Date.now();
  const response = await client.audio.speech.create({
    model: env.openAiTtsModel,
    voice,
    input: trimmedText,
    speed: Math.max(0.25, Math.min(4.0, speed)),
    response_format: "mp3"
  });

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);
  console.log(`[AI] tts.synthesize model=${env.openAiTtsModel} ${Date.now() - startedAt}ms`);

  return {
    audioBuffer,
    contentType: "audio/mpeg"
  };
}
