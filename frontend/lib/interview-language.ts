export const locales = ["vi", "zh", "en"] as const;
export type Locale = (typeof locales)[number];
export type BackendLanguage = "VI" | "ZH" | "EN";
export type InterviewLanguageMode = BackendLanguage | "BILINGUAL";

export function localeToBackendLanguage(locale: Locale): BackendLanguage {
  if (locale === "zh") return "ZH";
  if (locale === "en") return "EN";
  return "VI";
}

export function backendLanguageToLocale(language: BackendLanguage | null | undefined): Locale {
  if (language === "ZH") return "zh";
  if (language === "EN") return "en";
  return "vi";
}

export function interviewModeToBackendLanguage(mode: InterviewLanguageMode): BackendLanguage {
  return mode === "BILINGUAL" ? "ZH" : mode;
}

export function resolveStoredInterviewLanguageMode(
  stored: string | null | undefined
): InterviewLanguageMode {
  return stored === "VI" || stored === "ZH" || stored === "EN" || stored === "BILINGUAL"
    ? stored
    : "ZH";
}

export function backendLanguageToSpeechLocale(language: BackendLanguage): Locale {
  if (language === "VI") return "vi";
  if (language === "EN") return "en";
  return "zh";
}

export function backendLanguageToBrowserSpeechLang(language: BackendLanguage) {
  if (language === "VI") return "vi-VN";
  if (language === "EN") return "en-US";
  return "zh-CN";
}
