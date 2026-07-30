export type MajorDegreeLevel = "BACHELOR" | "MASTER";

export function normalizeMajorName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseMajorLines(value: string, degreeLevel: MajorDegreeLevel) {
  const seen = new Set<string>();
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, ""))
    .filter(Boolean)
    .map((line) => {
      const [name = "", nameZh = "", nameEn = ""] = line.split("|").map((part) => part.trim());
      return {
        degreeLevel,
        name,
        nameEn: nameEn || null,
        nameZh: nameZh || null
      };
    })
    .filter((major) => {
      const key = `${major.degreeLevel}:${normalizeMajorName(major.name)}`;
      if (!major.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
