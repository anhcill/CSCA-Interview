import { apiPost } from "./api";
import { getAuthToken } from "./auth-client";

// --- Speech metrics types ---
export type WordSegment = {
  word: string;
  start: number;
  end: number;
};

export type PauseDetail = {
  durationSec: number;
  category: "short" | "medium" | "long" | "very_long";
  afterWordIndex: number;
  context: string;
};

export type SpeechMetrics = {
  wpm: number;
  speedRating: "too_slow" | "slow" | "normal" | "fast" | "too_fast";
  durationSec: number;
  wordCount: number;
  pauseCount: number;
  longestPauseSec: number;
  avgPauseSec: number;
  pauses?: PauseDetail[];
  pausePenalty?: {
    shortCount: number;
    mediumCount: number;
    longCount: number;
    veryLongCount: number;
    totalPenalty: number;
  };
  fillerWords: { word: string; count: number }[];
  fillerWordTotal: number;
  fluencyScore: number;
  confidenceScore?: number;
  confidenceFactors?: {
    speedConsistency: number;
    pauseControl: number;
    fillerAvoidance: number;
    contentLength: number;
    overallRating: "low" | "medium" | "high" | "excellent";
  };
  language: string;
};

// --- Transcribe (STT) ---
export type TranscribeResponse = {
  text: string;
  language: string;
  duration?: number;
  words?: WordSegment[];
  speechMetrics?: SpeechMetrics;
};

export async function transcribeAudio(
  audioBase64: string,
  mimeType = "audio/webm",
  language?: "vi" | "zh" | "en"
): Promise<TranscribeResponse> {
  return apiPost<TranscribeResponse>(
    "/api/speech/transcribe",
    { audio: audioBase64, mimeType, language },
    { token: getAuthToken() }
  );
}

// --- Synthesize (TTS) ---
export type SynthesizeResponse = {
  audio: string; // base64
  contentType: string;
};

export async function synthesizeSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova",
  speed = 1.0
): Promise<SynthesizeResponse> {
  return apiPost<SynthesizeResponse>(
    "/api/speech/synthesize",
    { text, voice, speed },
    { token: getAuthToken() }
  );
}

// --- Pronunciation Assessment ---
export type PronunciationPhoneme = {
  phoneme: string;
  accuracyScore: number;
};

export type PronunciationWordDetail = {
  word: string;
  accuracyScore: number;
  errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
  phonemes?: PronunciationPhoneme[];
};

export type PronunciationResult = {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  words: PronunciationWordDetail[];
  recognizedText: string;
  language: string;
};

export async function assessPronunciation(
  audioBase64: string,
  language: "en" | "zh" | "vi" = "en",
  referenceText?: string
): Promise<PronunciationResult> {
  return apiPost<PronunciationResult>(
    "/api/speech/pronunciation",
    { audio: audioBase64, language, referenceText },
    { token: getAuthToken() }
  );
}

// --- Speech service status ---
export type SpeechStatus = {
  transcribe: boolean;
  synthesize: boolean;
  pronunciationAssessment: boolean;
};

export async function getSpeechStatus(): Promise<SpeechStatus> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4010"}/api/speech/status`,
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  );
  return res.json();
}

// --- Audio helpers ---
export function base64ToBlob(base64: string, contentType: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: contentType });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:...;base64, prefix
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

let activeSpeechAudio: HTMLAudioElement | null = null;
let finishActiveSpeechAudio: (() => void) | null = null;

export function stopActiveSpeechAudio() {
  if (!activeSpeechAudio) return;
  activeSpeechAudio.pause();
  activeSpeechAudio.currentTime = 0;
  finishActiveSpeechAudio?.();
}

export function playBase64Audio(base64: string, contentType = "audio/mpeg"): Promise<void> {
  return new Promise((resolve, reject) => {
    stopActiveSpeechAudio();
    const blob = base64ToBlob(base64, contentType);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    activeSpeechAudio = audio;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (activeSpeechAudio === audio) activeSpeechAudio = null;
      if (finishActiveSpeechAudio === finish) finishActiveSpeechAudio = null;
      URL.revokeObjectURL(url);
      resolve();
    };
    finishActiveSpeechAudio = finish;
    audio.onended = finish;
    audio.onerror = (e) => {
      if (settled) return;
      settled = true;
      if (activeSpeechAudio === audio) activeSpeechAudio = null;
      if (finishActiveSpeechAudio === finish) finishActiveSpeechAudio = null;
      URL.revokeObjectURL(url);
      reject(e);
    };
    audio.play().catch(reject);
  });
}
