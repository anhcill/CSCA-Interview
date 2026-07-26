import enMessages from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import zhMessages from "@/messages/zh.json";
import { apiPut } from "./api";
import { getAuthToken } from "./auth-client";
import {
  localeToBackendLanguage,
  resolveStoredInterviewLanguageMode,
  type InterviewLanguageMode,
  type Locale
} from "./interview-language";

export {
  backendLanguageToBrowserSpeechLang,
  backendLanguageToLocale,
  backendLanguageToSpeechLocale,
  interviewModeToBackendLanguage,
  localeToBackendLanguage,
  locales,
  type BackendLanguage,
  type InterviewLanguageMode,
  type Locale
} from "./interview-language";

export const localeKey = "ai_phongvan_locale";
export const interviewLanguageModeKey = "ai_phongvan_interview_language_mode";
export const localeChangedEvent = "ai-phongvan:locale-changed";

export const messages = {
  en: enMessages,
  vi: viMessages,
  zh: zhMessages
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "vi" || value === "zh" || value === "en";
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "vi";
  const stored = localStorage.getItem(localeKey);
  return isLocale(stored) ? stored : "vi";
}

export function setStoredLocale(locale: Locale, options: { persist?: boolean } = {}) {
  if (typeof window === "undefined") return;

  localStorage.setItem(localeKey, locale);
  document.documentElement.lang = locale;
  window.dispatchEvent(new CustomEvent(localeChangedEvent, { detail: { locale } }));

  if (options.persist) {
    void persistLocalePreference(locale);
  }
}

export async function persistLocalePreference(locale: Locale) {
  const token = getAuthToken();
  if (!token) return;

  try {
    await apiPut("/api/gamification/preferences", { preferredLanguage: localeToBackendLanguage(locale) }, { token });
  } catch {
    // Local preference still works when user is offline or not fully authenticated.
  }
}

export function getStoredInterviewLanguageMode(): InterviewLanguageMode {
  if (typeof window === "undefined") return "ZH";
  const stored = sessionStorage.getItem(interviewLanguageModeKey) ?? localStorage.getItem(interviewLanguageModeKey);
  return resolveStoredInterviewLanguageMode(stored);
}

export function setStoredInterviewLanguageMode(mode: InterviewLanguageMode) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(interviewLanguageModeKey, mode);
  localStorage.setItem(interviewLanguageModeKey, mode);
}

export function languageModeLabel(mode: InterviewLanguageMode, locale: Locale) {
  const t = messages[locale].interview;
  if (mode === "BILINGUAL") return t.languageBilingual;
  if (mode === "VI") return t.languageVi;
  if (mode === "EN") return t.languageEn;
  return t.languageZh;
}

export function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}
