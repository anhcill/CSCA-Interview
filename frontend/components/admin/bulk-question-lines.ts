export function parseBulkQuestionLines(value: string) {
  const seen = new Set<string>();
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "").trim())
    .filter((line) => {
      const normalized = line.replace(/\s+/g, " ").toLocaleLowerCase("vi");
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}
