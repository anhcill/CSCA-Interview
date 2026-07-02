/**
 * Azure Speech SDK — Pronunciation Assessment Service
 *
 * Provides phoneme-level pronunciation scoring using Azure Cognitive Services.
 * Supports: en-US, zh-CN, vi-VN
 *
 * Returns:
 *   - PronunciationScore (0-100)
 *   - AccuracyScore (phoneme level)
 *   - FluencyScore
 *   - CompletenessScore
 *   - Word-level details with error types
 */

import fs from "fs";
import path from "path";
import os from "os";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { env } from "../../config/env.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PronunciationWordDetail = {
  word: string;
  accuracyScore: number;
  errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
  phonemes?: PronunciationPhoneme[];
};

export type PronunciationPhoneme = {
  phoneme: string;
  accuracyScore: number;
};

export type PronunciationResult = {
  /** Overall pronunciation score 0-100 */
  pronunciationScore: number;
  /** Accuracy at word level 0-100 */
  accuracyScore: number;
  /** Fluency from Azure 0-100 */
  fluencyScore: number;
  /** Completeness (how much of reference text was spoken) 0-100 */
  completenessScore: number;
  /** Per-word breakdown */
  words: PronunciationWordDetail[];
  /** Recognized text by Azure */
  recognizedText: string;
  /** Language used for assessment */
  language: string;
};

// ---------------------------------------------------------------------------
// Language mapping
// ---------------------------------------------------------------------------

const LANG_MAP: Record<string, string> = {
  en: "en-US",
  zh: "zh-CN",
  vi: "vi-VN",
  "en-us": "en-US",
  "zh-cn": "zh-CN",
  "vi-vn": "vi-VN",
  english: "en-US",
  chinese: "zh-CN",
  vietnamese: "vi-VN",
};

function resolveLocale(lang?: string): string {
  if (!lang) return "en-US";
  const key = lang.toLowerCase();
  return LANG_MAP[key] ?? "en-US";
}

// ---------------------------------------------------------------------------
// Check Azure config
// ---------------------------------------------------------------------------

export class MissingAzureSpeechKeyError extends Error {
  constructor() {
    super(
      "AZURE_SPEECH_KEY chưa được cấu hình. Tính năng pronunciation assessment không khả dụng."
    );
    this.name = "MissingAzureSpeechKeyError";
  }
}

function requireAzureConfig() {
  if (!env.azureSpeechKey) throw new MissingAzureSpeechKeyError();
  return {
    key: env.azureSpeechKey,
    region: env.azureSpeechRegion,
  };
}

// ---------------------------------------------------------------------------
// Main: Assess pronunciation from audio buffer
// ---------------------------------------------------------------------------

/**
 * Assess pronunciation of audio against optional reference text.
 *
 * @param audioBase64 - Base64-encoded audio (WAV preferred, WebM/MP3 also accepted)
 * @param language - Language code: "en", "zh", "vi" or full locale
 * @param referenceText - Optional reference text to compare against.
 *                        If not provided, uses unreferenced assessment.
 */
export async function assessPronunciation(
  audioBase64: string,
  language?: string,
  referenceText?: string
): Promise<PronunciationResult> {
  const { key, region } = requireAzureConfig();
  const locale = resolveLocale(language);

  // Write audio to temp WAV file
  const buffer = Buffer.from(audioBase64, "base64");
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("File audio quá lớn (tối đa 10MB)");
  }

  const tmpFile = path.join(os.tmpdir(), `pronun_${Date.now()}.wav`);

  try {
    fs.writeFileSync(tmpFile, buffer);

    const result = await runAzureAssessment(key, region, tmpFile, locale, referenceText);
    return result;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup
    }
  }
}

// ---------------------------------------------------------------------------
// Azure SDK integration
// ---------------------------------------------------------------------------

function runAzureAssessment(
  subscriptionKey: string,
  region: string,
  audioFilePath: string,
  locale: string,
  referenceText?: string
): Promise<PronunciationResult> {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, region);
    speechConfig.speechRecognitionLanguage = locale;

    const audioConfig = sdk.AudioConfig.fromWavFileInput(
      fs.readFileSync(audioFilePath)
    );

    // Pronunciation assessment config
    const pronConfig = referenceText
      ? new sdk.PronunciationAssessmentConfig(
          referenceText,
          sdk.PronunciationAssessmentGradingSystem.HundredMark,
          sdk.PronunciationAssessmentGranularity.Phoneme,
          true // enableMiscue
        )
      : new sdk.PronunciationAssessmentConfig(
          "",
          sdk.PronunciationAssessmentGradingSystem.HundredMark,
          sdk.PronunciationAssessmentGranularity.Phoneme,
          false
        );

    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    pronConfig.applyTo(recognizer);

    const startedAt = Date.now();

    recognizer.recognizeOnceAsync(
      (speechResult) => {
        console.log(`[AZURE] pronunciation assessment ${Date.now() - startedAt}ms`);

        if (
          speechResult.reason === sdk.ResultReason.RecognizedSpeech ||
          speechResult.reason === sdk.ResultReason.RecognizingSpeech
        ) {
          const pronResult =
            sdk.PronunciationAssessmentResult.fromResult(speechResult);

          // Extract word-level details
          const words = extractWordDetails(speechResult);

          resolve({
            pronunciationScore: round2(pronResult.pronunciationScore),
            accuracyScore: round2(pronResult.accuracyScore),
            fluencyScore: round2(pronResult.fluencyScore),
            completenessScore: round2(pronResult.completenessScore),
            words,
            recognizedText: speechResult.text ?? "",
            language: locale,
          });
        } else if (speechResult.reason === sdk.ResultReason.NoMatch) {
          resolve({
            pronunciationScore: 0,
            accuracyScore: 0,
            fluencyScore: 0,
            completenessScore: 0,
            words: [],
            recognizedText: "",
            language: locale,
          });
        } else {
          reject(
            new Error(
              `Azure Speech recognition failed: ${sdk.ResultReason[speechResult.reason]} — ${speechResult.errorDetails ?? "unknown error"}`
            )
          );
        }

        recognizer.close();
      },
      (err) => {
        recognizer.close();
        reject(new Error(`Azure Speech SDK error: ${err}`));
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Extract word-level pronunciation details from SDK result
// ---------------------------------------------------------------------------

function extractWordDetails(
  result: sdk.SpeechRecognitionResult
): PronunciationWordDetail[] {
  try {
    const jsonStr = result.properties.getProperty(
      sdk.PropertyId.SpeechServiceResponse_JsonResult
    );
    if (!jsonStr) return [];

    const json = JSON.parse(jsonStr);
    const nBest = json?.NBest;
    if (!Array.isArray(nBest) || nBest.length === 0) return [];

    const best = nBest[0];
    if (!Array.isArray(best?.Words)) return [];

    return best.Words.map(
      (w: {
        Word: string;
        PronunciationAssessment?: {
          AccuracyScore?: number;
          ErrorType?: string;
        };
        Phonemes?: Array<{
          Phoneme: string;
          PronunciationAssessment?: { AccuracyScore?: number };
        }>;
      }) => {
        const pa = w.PronunciationAssessment;
        const phonemes: PronunciationPhoneme[] = Array.isArray(w.Phonemes)
          ? w.Phonemes.map((p) => ({
              phoneme: p.Phoneme,
              accuracyScore: round2(
                p.PronunciationAssessment?.AccuracyScore ?? 0
              ),
            }))
          : [];

        return {
          word: w.Word,
          accuracyScore: round2(pa?.AccuracyScore ?? 0),
          errorType: (pa?.ErrorType ?? "None") as PronunciationWordDetail["errorType"],
          phonemes,
        };
      }
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Check if Azure pronunciation assessment is available (key configured).
 */
export function isPronunciationAvailable(): boolean {
  return Boolean(env.azureSpeechKey);
}
