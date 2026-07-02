export function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchTokens(value: string) {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function rankSearchCandidate(query: string, fields: Array<string | null | undefined>) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 1;

  const tokens = searchTokens(query);
  const normalizedFields = fields
    .map((field) => normalizeSearchText(field ?? ""))
    .filter(Boolean);

  let bestScore = 0;

  for (const field of normalizedFields) {
    const initials = field
      .split(" ")
      .map((word) => word[0] ?? "")
      .join("");

    if (field === normalizedQuery) bestScore = Math.max(bestScore, 100);
    if (field.startsWith(normalizedQuery)) bestScore = Math.max(bestScore, 90);
    if (field.includes(` ${normalizedQuery}`)) bestScore = Math.max(bestScore, 80);
    if (field.includes(normalizedQuery)) bestScore = Math.max(bestScore, 70);
    if (initials.startsWith(normalizedQuery)) bestScore = Math.max(bestScore, 65);
    if (tokens.length && tokens.every((token) => field.includes(token))) bestScore = Math.max(bestScore, 55);
    if (tokens.some((token) => field.includes(token))) bestScore = Math.max(bestScore, 20);
  }

  return bestScore;
}
