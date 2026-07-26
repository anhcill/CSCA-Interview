export function normalizeOtherLanguagesInput(value: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  return normalized || null;
}
