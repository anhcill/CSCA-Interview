import { apiPost } from "./api";
import { getAuthToken } from "./auth-client";

// --- Transcribe (STT) ---
export type TranscribeResponse = {
  text: string;
  language: string;
  duration?: number;
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

export function playBase64Audio(base64: string, contentType = "audio/mpeg"): Promise<void> {
  return new Promise((resolve, reject) => {
    const blob = base64ToBlob(base64, contentType);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    audio.play().catch(reject);
  });
}
