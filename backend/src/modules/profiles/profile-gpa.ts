import { DegreeLevel } from "@prisma/client";

export type GpaValidationResult = {
  error: string | null;
  value: string | null;
};

const bachelorGpaPattern = /^Lớp 10:\s*([\d.,]+);\s*Lớp 11:\s*([\d.,]+);\s*Lớp 12:\s*([\d.,]+)$/i;
const masterGpaPattern = /^([\d.,]+)\s*(?:\/\s*4(?:\.0)?)?$/i;

export function normalizeAndValidateGpa(
  degreeLevel: DegreeLevel,
  rawValue?: string | null
): GpaValidationResult {
  const value = rawValue?.trim();
  if (!value) return { error: null, value: null };

  if (degreeLevel === DegreeLevel.MASTER) {
    const match = value.match(masterGpaPattern);
    const score = match ? toScore(match[1]) : Number.NaN;
    if (!Number.isFinite(score) || score < 0 || score > 4) {
      return {
        error: "GPA hệ thạc sĩ phải là GPA đại học theo thang 4.",
        value: null
      };
    }

    return { error: null, value: formatScore(score) };
  }

  const match = value.match(bachelorGpaPattern);
  const scores = match?.slice(1).map(toScore) ?? [];
  if (
    scores.length !== 3 ||
    scores.some((score) => !Number.isFinite(score) || score < 0 || score > 10)
  ) {
    return {
      error: "GPA hệ đại học cần đủ điểm lớp 10, 11, 12 theo thang 10.",
      value: null
    };
  }

  return {
    error: null,
    value: `Lớp 10: ${formatScore(scores[0])}; Lớp 11: ${formatScore(scores[1])}; Lớp 12: ${formatScore(scores[2])}`
  };
}

function toScore(value: string) {
  return Number(value.replace(",", "."));
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
