import type { messages } from "@/lib/i18n";

export const speechVoiceStorageKey = "ai_phongvan_speech_voice";
export const speechRateStorageKey = "ai_phongvan_speech_rate";
export const questionReaderStorageKey = "ai_phongvan_question_reader";

export type SpeechVoicePreset = "auto" | "female" | "male" | "warm" | "slow" | "clear";
export type SpeechRate = 0.5 | 0.75 | 1 | 1.25 | 1.5;
export type RemoteSpeechVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type QuestionReaderMode = "ai" | "human";

export const voicePresets: SpeechVoicePreset[] = ["auto", "female", "male", "warm", "slow", "clear"];
export const speechRates: SpeechRate[] = [0.5, 0.75, 1, 1.25, 1.5];

export class MissingBrowserVoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingBrowserVoiceError";
  }
}

export function getVoicePresetLabel(preset: SpeechVoicePreset, t: (typeof messages)["vi"]["interview"]) {
  const labels: Record<SpeechVoicePreset, string> = {
    auto: t.voiceAuto,
    clear: t.voiceClear,
    female: t.voiceFemale,
    male: t.voiceMale,
    slow: t.voiceSlow,
    warm: t.voiceWarm
  };
  return labels[preset];
}

export function inferSpeechLang(text: string, fallback: string) {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  if (/[\u00c0-\u1ef9]/i.test(text)) {
    return "vi-VN";
  }
  if (/[a-z]/i.test(text) && fallback === "zh-CN") return "vi-VN";
  return fallback;
}

export function isSpeechVoicePreset(value: string | null): value is SpeechVoicePreset {
  return value === "auto" || value === "female" || value === "male" || value === "warm" || value === "slow" || value === "clear";
}

export function isSpeechRate(value: number): value is SpeechRate {
  return speechRates.includes(value as SpeechRate);
}

export function isQuestionReaderMode(value: string | null): value is QuestionReaderMode {
  return value === "ai" || value === "human";
}

export function shouldPreferRemoteSpeech(preset: SpeechVoicePreset) {
  return preset !== "auto";
}

export function getRemoteSpeechPreset(preset: SpeechVoicePreset, lang: string, speechRate: SpeechRate): { voice: RemoteSpeechVoice; speed: number } {
  const speed = getPresetRate(lang, preset, speechRate);
  if (preset === "male") return { voice: "onyx", speed };
  if (preset === "warm") return { voice: "shimmer", speed };
  if (preset === "clear") return { voice: "shimmer", speed };
  return { voice: "nova", speed };
}

export async function speakWithBrowser(text: string, lang: string, errorMessage: string, preset: SpeechVoicePreset = "auto", speechRate: SpeechRate = 1) {
  const voices = await getBrowserVoices();
  const voice = pickPresetVoice(voices, lang, preset);

  if (!voice) {
    const presetLabel = preset === "female" ? "nữ" : preset === "male" ? "nam" : "phù hợp";
    throw new MissingBrowserVoiceError(`Máy chưa có giọng ${presetLabel} cho ${lang}.`);
  }

  return new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? lang;
    utterance.rate = getPresetRate(lang, preset, speechRate);
    utterance.pitch = getPresetPitch(preset);
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error(errorMessage));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

function getBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
      return;
    }

    const timeout = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string) {
  const normalized = lang.toLowerCase();
  const base = normalized.split("-")[0];
  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalized) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${base}-`)) ??
    null
  );
}

function normalizeVoiceName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const femaleVoiceHints = [
  "female",
  "woman",
  "girl",
  "zira",
  "jenny",
  "aria",
  "sara",
  "susan",
  "victoria",
  "huihui",
  "xiaoxiao",
  "xiaoyi",
  "xiaomo",
  "xiaohan",
  "xiaorui",
  "xiaoqiu",
  "xiaorong",
  "xiaoxuan",
  "xiaoshuang",
  "xiaobei",
  "xiaoni",
  "yaoyao",
  "hanhan",
  "tingting",
  "tracy",
  "mei",
  "hoaimy",
  "hoai",
  "my",
  "linh",
  "mai"
];

const maleVoiceHints = [
  "boy",
  "david",
  "mark",
  "george",
  "daniel",
  "alex",
  "paul",
  "namminh",
  "nam minh",
  "kangkang",
  "yunjian",
  "yunxi",
  "yunyang",
  "yunhao",
  "yunze",
  "yunfeng"
];

const warmVoiceHints = ["natural", "premium", "online", "xiaoxiao", "zira", "jenny", "aria", "hoaimy", "linh", "mei"];

function getVoiceSearchKey(voice: SpeechSynthesisVoice) {
  return normalizeVoiceName(`${voice.name} ${voice.voiceURI}`);
}

function scorePresetVoice(voice: SpeechSynthesisVoice, wantedHints: string[], blockedHints: string[]) {
  const key = getVoiceSearchKey(voice);
  const wantedScore = wantedHints.reduce((score, hint) => score + (key.includes(hint) ? 4 : 0), 0);
  const blockedScore = blockedHints.reduce((score, hint) => score + (key.includes(hint) ? 8 : 0), 0);
  const naturalScore = key.includes("natural") || key.includes("online") ? 1 : 0;
  return wantedScore + naturalScore - blockedScore;
}

function pickPresetVoice(voices: SpeechSynthesisVoice[], lang: string, preset: SpeechVoicePreset) {
  const normalized = lang.toLowerCase();
  const base = normalized.split("-")[0];
  const languageVoices = voices.filter((voice) => {
    const voiceLang = voice.lang.toLowerCase();
    return voiceLang === normalized || voiceLang.startsWith(`${base}-`);
  });

  if (preset === "auto" || preset === "slow" || preset === "clear") return pickVoice(voices, lang);

  if (!languageVoices.length) return null;

  const wantedHints = preset === "female" ? femaleVoiceHints : preset === "male" ? maleVoiceHints : warmVoiceHints;
  const blockedHints = preset === "female" ? maleVoiceHints : preset === "male" ? femaleVoiceHints : [];

  const scored = languageVoices
    .map((voice) => {
      return { score: scorePresetVoice(voice, wantedHints, blockedHints), voice };
    })
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].voice;

  return preset === "warm" ? pickVoice(languageVoices, lang) : null;
}

function getPresetRate(lang: string, preset: SpeechVoicePreset, speechRate: SpeechRate = 1) {
  const baseRate = (() => {
    if (preset === "slow") return lang === "zh-CN" ? 0.92 : 0.95;
    if (preset === "clear") return lang === "zh-CN" ? 1.06 : 1.08;
    if (preset === "warm") return lang === "zh-CN" ? 0.98 : 1;
    return lang === "zh-CN" ? 1.02 : 1.04;
  })();
  return Math.min(1.8, Math.max(0.45, baseRate * speechRate));
}

function getPresetPitch(preset: SpeechVoicePreset) {
  if (preset === "female") return 1.06;
  if (preset === "male") return 0.94;
  if (preset === "warm") return 0.96;
  return 1;
}
