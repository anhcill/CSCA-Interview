import { prisma } from "../../db/prisma.js";

export const testerExperienceSettingKey = "tester_experience";

export type TesterExperienceConfig = {
  feedbackEnabled: boolean;
  feedbackTitle: string;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  welcomeTitle: string;
};

export const defaultTesterExperienceConfig: TesterExperienceConfig = {
  feedbackEnabled: true,
  feedbackTitle: "Góp ý cho MOLY",
  welcomeEnabled: true,
  welcomeMessage: "Chúc bạn một ngày Chủ nhật vui vẻ, tràn đầy năng lượng và có buổi trải nghiệm thật hiệu quả!",
  welcomeTitle: "Chào mừng bạn đến với MOLY!"
};

export function normalizeTesterExperienceConfig(value: unknown): TesterExperienceConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultTesterExperienceConfig;
  const input = value as Record<string, unknown>;

  return {
    feedbackEnabled: typeof input.feedbackEnabled === "boolean"
      ? input.feedbackEnabled
      : defaultTesterExperienceConfig.feedbackEnabled,
    feedbackTitle: readText(input.feedbackTitle, defaultTesterExperienceConfig.feedbackTitle, 100),
    welcomeEnabled: typeof input.welcomeEnabled === "boolean"
      ? input.welcomeEnabled
      : defaultTesterExperienceConfig.welcomeEnabled,
    welcomeMessage: readText(input.welcomeMessage, defaultTesterExperienceConfig.welcomeMessage, 500),
    welcomeTitle: readText(input.welcomeTitle, defaultTesterExperienceConfig.welcomeTitle, 120)
  };
}

export async function getTesterExperienceConfig() {
  const setting = await prisma.system_settings.findUnique({
    select: { setting_value: true },
    where: { setting_key: testerExperienceSettingKey }
  });

  return normalizeTesterExperienceConfig(setting?.setting_value);
}

function readText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}
