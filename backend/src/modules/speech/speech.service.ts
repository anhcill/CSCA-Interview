import fs from "fs";
import path from "path";
import os from "os";
import { ai_task_type } from "@prisma/client";
import OpenAI from "openai";
import { env, type OpenAiTtsVoice } from "../../config/env.js";
import { logAiUsage } from "../ai/ai-usage.service.js";

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

// ---------------------------------------------------------------------------
// Word-level segment from Whisper verbose_json
// ---------------------------------------------------------------------------
export type WordSegment = {
  word: string;
  start: number;
  end: number;
};

// ---------------------------------------------------------------------------
// Speech analysis metrics
// ---------------------------------------------------------------------------
/** Categorized pause detail */
export type PauseDetail = {
  /** Gap in seconds */
  durationSec: number;
  /** Category */
  category: "short" | "medium" | "long" | "very_long";
  /** Position (after which word index) */
  afterWordIndex: number;
  /** Words surrounding the pause for context */
  context: string;
};

export type SpeechMetrics = {
  /** Words per minute */
  wpm: number;
  /** Rating: slow / normal / fast */
  speedRating: "too_slow" | "slow" | "normal" | "fast" | "too_fast";
  /** Total duration in seconds */
  durationSec: number;
  /** Total word/character count */
  wordCount: number;
  /** Number of pauses > threshold */
  pauseCount: number;
  /** Longest pause in seconds */
  longestPauseSec: number;
  /** Average pause length in seconds */
  avgPauseSec: number;
  /** Categorized pause breakdown */
  pauses: PauseDetail[];
  /** Pause penalty breakdown */
  pausePenalty: {
    shortCount: number;
    mediumCount: number;
    longCount: number;
    veryLongCount: number;
    totalPenalty: number;
  };
  /** Filler words detected */
  fillerWords: { word: string; count: number }[];
  /** Total filler word count */
  fillerWordTotal: number;
  /** Overall fluency score 0-100 */
  fluencyScore: number;
  /** Speaking confidence score 0-100 */
  confidenceScore: number;
  /** Confidence breakdown */
  confidenceFactors: {
    speedConsistency: number;
    pauseControl: number;
    fillerAvoidance: number;
    contentLength: number;
    overallRating: "low" | "medium" | "high" | "excellent";
  };
  /** Detected language */
  language: string;
};

export type TranscribeResult = {
  text: string;
  language: string;
  duration?: number;
  words?: WordSegment[];
  speechMetrics?: SpeechMetrics;
};

type VerboseTranscriptionResponse = {
  text: string;
  language?: string;
  duration?: number;
  words?: unknown;
  segments?: unknown;
};

export type SynthesizeResult = {
  audioBuffer: Buffer;
  contentType: string;
};

export type SpeechUsageOptions = {
  userId?: string | null;
};

type SpeechUsageOperation = "speech.transcribe" | "speech.synthesize";

// Temporary bucket until Prisma gets speech-specific ai_task_type values.
const speechAiUsageTaskType = ai_task_type.IMPROVE_ANSWER;

function isWhisperTranscriptionModel(model: string) {
  return model.toLowerCase().endsWith("whisper-1");
}

function supportsTtsSpeed(model: string) {
  return !model.toLowerCase().endsWith("gpt-4o-mini-tts");
}

/**
 * Transcribe audio using OpenAI audio transcription API.
 * Accepts a base64-encoded audio string + mime type.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = "audio/webm",
  language?: string,
  options: SpeechUsageOptions = {}
): Promise<TranscribeResult> {
  const client = requireOpenAi();

  // Write base64 to temp file (OpenAI transcription API needs a file)
  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "webm";
  const tmpFile = path.join(os.tmpdir(), `speech_${Date.now()}.${ext}`);
  const transcriptionModel = env.openAiSttModel;
  let audioBytes: number | null = null;

  try {
    const buffer = Buffer.from(audioBase64, "base64");
    audioBytes = buffer.length;

    // Limit: 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error("File audio quá lớn (tối đa 10MB)");
    }

    fs.writeFileSync(tmpFile, buffer);

    const startedAt = Date.now();
    const createTranscription = client.audio.transcriptions.create as unknown as (body: Record<string, unknown>) => Promise<VerboseTranscriptionResponse>;
    const transcriptionInput: Record<string, unknown> = {
      file: fs.createReadStream(tmpFile),
      model: transcriptionModel,
      ...(language ? { language } : {}),
      response_format: isWhisperTranscriptionModel(transcriptionModel) ? "verbose_json" : "json"
    };
    if (isWhisperTranscriptionModel(transcriptionModel)) {
      transcriptionInput.timestamp_granularities = ["word"];
    }
    let transcription: VerboseTranscriptionResponse;
    try {
      transcription = await createTranscription(transcriptionInput);
    } catch (error) {
      await logSpeechAiUsage({
        errorMessage: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
        model: transcriptionModel,
        operation: "speech.transcribe",
        requestPayload: {
          audioBytes,
          language: language ?? null,
          mimeType,
          responseFormat: transcriptionInput.response_format
        },
        userId: options.userId ?? null
      });
      throw error;
    }

    const latencyMs = Date.now() - startedAt;
    console.log(`[AI] stt.transcribe model=${transcriptionModel} ${latencyMs}ms`);

    const detectedLang = transcription.language ?? language ?? "unknown";
    const duration = transcription.duration ?? undefined;

    // Extract word-level segments from verbose_json
    const words = extractWordSegments(transcription);

    // Compute speech metrics
    const speechMetrics = duration
      ? analyzeSpeech(transcription.text, duration, words, detectedLang)
      : undefined;

    await logSpeechAiUsage({
      latencyMs,
      model: transcriptionModel,
      operation: "speech.transcribe",
      requestPayload: {
        audioBytes,
        language: language ?? null,
        mimeType,
        responseFormat: transcriptionInput.response_format
      },
      responsePayload: {
        detectedLanguage: detectedLang,
        durationSec: duration ?? null,
        textLength: transcription.text.length,
        wordSegments: words.length
      },
      userId: options.userId ?? null
    });

    return {
      text: transcription.text,
      language: detectedLang,
      duration,
      words,
      speechMetrics
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
  voice: OpenAiTtsVoice = env.openAiTtsVoice,
  speed: number = 1.0,
  options: SpeechUsageOptions = {}
): Promise<SynthesizeResult> {
  const client = requireOpenAi();

  if (!text.trim()) {
    throw new Error("Text không được để trống");
  }

  // Limit text length to prevent abuse (max ~4096 chars)
  const trimmedText = text.slice(0, 4096);

  const startedAt = Date.now();
  const ttsModel = env.openAiTtsModel;
  const normalizedSpeed = Math.max(0.25, Math.min(4.0, speed));
  const ttsSupportsSpeed = supportsTtsSpeed(ttsModel);

  try {
    const response = await client.audio.speech.create({
      model: ttsModel,
      voice,
      input: trimmedText,
      ...(ttsSupportsSpeed ? { speed: normalizedSpeed } : {}),
      response_format: "mp3"
    });

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const latencyMs = Date.now() - startedAt;
    console.log(`[AI] tts.synthesize model=${ttsModel} voice=${voice} ${latencyMs}ms`);

    await logSpeechAiUsage({
      latencyMs,
      model: ttsModel,
      operation: "speech.synthesize",
      requestPayload: {
        inputChars: trimmedText.length,
        speed: ttsSupportsSpeed ? normalizedSpeed : null,
        voice
      },
      responsePayload: {
        audioBytes: audioBuffer.length,
        contentType: "audio/mpeg"
      },
      userId: options.userId ?? null
    });

    return {
      audioBuffer,
      contentType: "audio/mpeg"
    };
  } catch (error) {
    await logSpeechAiUsage({
      errorMessage: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
      model: ttsModel,
      operation: "speech.synthesize",
      requestPayload: {
        inputChars: trimmedText.length,
        speed: ttsSupportsSpeed ? normalizedSpeed : null,
        voice
      },
      userId: options.userId ?? null
    });
    throw error;
  }
}

async function logSpeechAiUsage(input: {
  errorMessage?: string | null;
  latencyMs: number;
  model: string;
  operation: SpeechUsageOperation;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  userId?: string | null;
}) {
  await logAiUsage({
    errorMessage: input.errorMessage ?? null,
    latencyMs: input.latencyMs,
    model: input.model,
    provider: "openai",
    requestPayload: {
      feature: "speech",
      operation: input.operation,
      ...(input.requestPayload ?? {})
    },
    responsePayload: input.responsePayload,
    taskType: speechAiUsageTaskType,
    userId: input.userId ?? null
  });
}

// ---------------------------------------------------------------------------
// Extract word-level segments from Whisper verbose_json response
// ---------------------------------------------------------------------------

function extractWordSegments(transcription: unknown): WordSegment[] {
  const t = transcription as Record<string, unknown>;

  // Whisper verbose_json may return words array directly
  if (Array.isArray(t.words)) {
    return (t.words as Array<Record<string, unknown>>)
      .filter((w) => typeof w.word === "string" && typeof w.start === "number")
      .map((w) => ({
        word: (w.word as string).trim(),
        start: w.start as number,
        end: (w.end as number) ?? (w.start as number)
      }));
  }

  // Or inside segments[].words
  if (Array.isArray(t.segments)) {
    const words: WordSegment[] = [];
    for (const seg of t.segments as Array<Record<string, unknown>>) {
      if (Array.isArray(seg.words)) {
        for (const w of seg.words as Array<Record<string, unknown>>) {
          if (typeof w.word === "string" && typeof w.start === "number") {
            words.push({
              word: (w.word as string).trim(),
              start: w.start as number,
              end: (w.end as number) ?? (w.start as number)
            });
          }
        }
      }
    }
    return words;
  }

  return [];
}

// ---------------------------------------------------------------------------
// Filler words by language
// ---------------------------------------------------------------------------

const FILLER_WORDS: Record<string, string[]> = {
  en: ["uh", "um", "er", "ah", "like", "you know", "i mean", "so", "well", "basically", "actually", "literally"],
  zh: ["嗯", "呃", "那个", "就是", "然后", "对吧", "这个", "怎么说", "额"],
  vi: ["ờ", "ừ", "à", "ơ", "kiểu", "nghĩa là", "thì", "cái", "đó", "ấy"],
};

// ---------------------------------------------------------------------------
// WPM ideal ranges by language
// ---------------------------------------------------------------------------

function getSpeedRating(wpm: number, lang: string): SpeechMetrics["speedRating"] {
  // Chinese: characters per minute (ideal 200-280)
  if (lang === "zh" || lang === "chinese") {
    if (wpm < 120) return "too_slow";
    if (wpm < 180) return "slow";
    if (wpm <= 280) return "normal";
    if (wpm <= 350) return "fast";
    return "too_fast";
  }
  // English / Vietnamese (ideal 120-160 WPM)
  if (wpm < 80) return "too_slow";
  if (wpm < 120) return "slow";
  if (wpm <= 170) return "normal";
  if (wpm <= 220) return "fast";
  return "too_fast";
}

// ---------------------------------------------------------------------------
// Count words — for Chinese count characters, for others count space-separated
// ---------------------------------------------------------------------------

function countWords(text: string, lang: string): number {
  if (!text.trim()) return 0;
  if (lang === "zh" || lang === "chinese") {
    // Count CJK characters
    const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
    return cjk ? cjk.length : text.split(/\s+/).filter(Boolean).length;
  }
  return text.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Main speech analysis function
// ---------------------------------------------------------------------------

const PAUSE_THRESHOLD_SEC = 1.5; // Gap > 1.5s = significant pause

export function analyzeSpeech(
  text: string,
  durationSec: number,
  words: WordSegment[],
  language: string
): SpeechMetrics {
  const langKey = language.toLowerCase().startsWith("zh") || language === "chinese" ? "zh"
    : language.toLowerCase().startsWith("vi") || language === "vietnamese" ? "vi"
    : "en";

  const wordCount = countWords(text, langKey);
  const wpm = durationSec > 0 ? Math.round((wordCount / durationSec) * 60) : 0;
  const speedRating = getSpeedRating(wpm, langKey);

  // --- Enhanced pause analysis with categorization ---
  const pauseDetails: PauseDetail[] = [];
  if (words.length > 1) {
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].start - words[i - 1].end;
      if (gap > 0.8) { // Lower threshold to catch short pauses too
        const category: PauseDetail["category"] =
          gap <= 1.5 ? "short" :
          gap <= 3.0 ? "medium" :
          gap <= 5.0 ? "long" : "very_long";

        const prevWord = words[i - 1]?.word ?? "";
        const nextWord = words[i]?.word ?? "";
        pauseDetails.push({
          durationSec: Math.round(gap * 100) / 100,
          category,
          afterWordIndex: i - 1,
          context: `"...${prevWord}" [${Math.round(gap * 10) / 10}s] "${nextWord}..."`
        });
      }
    }
  }

  // Significant pauses (>1.5s) for backward compat
  const significantPauses = pauseDetails.filter(p => p.category !== "short");
  const pauseCount = significantPauses.length;
  const allPauseDurations = significantPauses.map(p => p.durationSec);
  const longestPauseSec = allPauseDurations.length > 0 ? Math.max(...allPauseDurations) : 0;
  const avgPauseSec = allPauseDurations.length > 0
    ? Math.round((allPauseDurations.reduce((a, b) => a + b, 0) / allPauseDurations.length) * 100) / 100
    : 0;

  // Pause penalty breakdown
  const shortCount = pauseDetails.filter(p => p.category === "short").length;
  const mediumCount = pauseDetails.filter(p => p.category === "medium").length;
  const longCount = pauseDetails.filter(p => p.category === "long").length;
  const veryLongCount = pauseDetails.filter(p => p.category === "very_long").length;
  // Penalty tiers: short=0, medium=3, long=7, very_long=12
  const totalPausePenalty = Math.min(40, mediumCount * 3 + longCount * 7 + veryLongCount * 12);

  // --- Filler word detection ---
  const textLower = text.toLowerCase();
  const fillerList = FILLER_WORDS[langKey] ?? FILLER_WORDS.en;
  const fillerWords: { word: string; count: number }[] = [];
  let fillerWordTotal = 0;

  for (const filler of fillerList) {
    // Count occurrences — for multi-word fillers use indexOf loop
    let count = 0;
    let idx = 0;
    const search = filler.toLowerCase();
    while (true) {
      idx = textLower.indexOf(search, idx);
      if (idx === -1) break;
      count++;
      idx += search.length;
    }
    if (count > 0) {
      fillerWords.push({ word: filler, count });
      fillerWordTotal += count;
    }
  }

  // --- Fluency score (0-100) ---
  // Components:
  //   Speed penalty: deviation from ideal range
  //   Pause penalty: too many / too long pauses
  //   Filler penalty: too many filler words
  let fluencyScore = 100;

  // Speed penalty (max -30)
  if (speedRating === "too_slow") fluencyScore -= 25;
  else if (speedRating === "slow") fluencyScore -= 10;
  else if (speedRating === "fast") fluencyScore -= 10;
  else if (speedRating === "too_fast") fluencyScore -= 20;

  // Pause penalty (max -35)
  // Each long pause: -5, longest pause > 5s: extra -10
  const pausePenalty = Math.min(35, pauseCount * 5 + (longestPauseSec > 5 ? 10 : 0));
  fluencyScore -= pausePenalty;

  // Filler word penalty (max -25)
  // Each filler: -2, cap at 25
  const fillerRatio = wordCount > 0 ? fillerWordTotal / wordCount : 0;
  const fillerPenalty = Math.min(25, Math.round(fillerRatio * 200));
  fluencyScore -= fillerPenalty;

  // Content too short penalty
  if (wordCount < 10) fluencyScore -= 10;

  fluencyScore = Math.max(0, Math.min(100, fluencyScore));

  // --- Speaking confidence score (0-100) ---
  // Based on: speed consistency, pause control, filler avoidance, content length

  // Speed consistency: how close to ideal range (100 = perfect)
  const speedConsistency = speedRating === "normal" ? 100
    : speedRating === "slow" || speedRating === "fast" ? 70
    : 40; // too_slow / too_fast

  // Pause control: fewer/shorter pauses = more confident (100 = no significant pauses)
  const pauseControl = Math.max(0, 100 - totalPausePenalty * 2.5);

  // Filler avoidance: fewer fillers = more confident
  const fillerAvoidance = Math.max(0, 100 - Math.min(100, fillerRatio * 300));

  // Content length: longer = more confident (up to a point)
  const contentLength = wordCount >= 50 ? 100
    : wordCount >= 30 ? 85
    : wordCount >= 15 ? 65
    : wordCount >= 5 ? 40
    : 10;

  // Weighted average
  const confidenceScore = Math.round(
    speedConsistency * 0.2 +
    pauseControl * 0.35 +
    fillerAvoidance * 0.25 +
    contentLength * 0.2
  );

  const overallRating: SpeechMetrics["confidenceFactors"]["overallRating"] =
    confidenceScore >= 85 ? "excellent"
    : confidenceScore >= 65 ? "high"
    : confidenceScore >= 45 ? "medium"
    : "low";

  return {
    wpm,
    speedRating,
    durationSec: Math.round(durationSec * 100) / 100,
    wordCount,
    pauseCount,
    longestPauseSec,
    avgPauseSec,
    pauses: pauseDetails,
    pausePenalty: {
      shortCount,
      mediumCount,
      longCount,
      veryLongCount,
      totalPenalty: totalPausePenalty,
    },
    fillerWords,
    fillerWordTotal,
    fluencyScore,
    confidenceScore,
    confidenceFactors: {
      speedConsistency,
      pauseControl: Math.round(pauseControl),
      fillerAvoidance: Math.round(fillerAvoidance),
      contentLength,
      overallRating,
    },
    language: langKey
  };
}
