import { describe, expect, it } from "vitest";
import {
  backendLanguageToBrowserSpeechLang,
  backendLanguageToSpeechLocale,
  interviewModeToBackendLanguage,
  localeToBackendLanguage,
  resolveStoredInterviewLanguageMode
} from "./interview-language";

describe("interview language mapping", () => {
  it("defaults new interviews to Chinese independently from UI locale", () => {
    expect(resolveStoredInterviewLanguageMode(null)).toBe("ZH");
    expect(localeToBackendLanguage("vi")).toBe("VI");
  });

  it("keeps an explicit interview language selection", () => {
    expect(resolveStoredInterviewLanguageMode("VI")).toBe("VI");
    expect(resolveStoredInterviewLanguageMode("EN")).toBe("EN");
    expect(resolveStoredInterviewLanguageMode("BILINGUAL")).toBe("BILINGUAL");
  });

  it("maps the selected session language to STT and browser TTS locales", () => {
    expect(backendLanguageToSpeechLocale("ZH")).toBe("zh");
    expect(backendLanguageToBrowserSpeechLang("ZH")).toBe("zh-CN");
    expect(backendLanguageToSpeechLocale("EN")).toBe("en");
    expect(backendLanguageToBrowserSpeechLang("EN")).toBe("en-US");
    expect(backendLanguageToSpeechLocale("VI")).toBe("vi");
    expect(backendLanguageToBrowserSpeechLang("VI")).toBe("vi-VN");
  });

  it("uses Chinese as the backend language for bilingual support mode", () => {
    expect(interviewModeToBackendLanguage("BILINGUAL")).toBe("ZH");
  });
});
