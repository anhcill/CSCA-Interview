const bachelorGpaPattern = /Lớp 10:\s*([\d.,]*);\s*Lớp 11:\s*([\d.,]*);\s*Lớp 12:\s*([\d.,]*)/i;

export function parseBachelorGpa(value: string) {
  const match = value.match(bachelorGpaPattern);
  if (match) {
    return {
      grade10: normalizeDecimal(match[1]),
      grade11: normalizeDecimal(match[2]),
      grade12: normalizeDecimal(match[3])
    };
  }

  return { grade10: "", grade11: "", grade12: "" };
}

export function formatBachelorGpa(grades: { grade10: string; grade11: string; grade12: string }) {
  if (!grades.grade10 && !grades.grade11 && !grades.grade12) return "";
  return `Lớp 10: ${grades.grade10}; Lớp 11: ${grades.grade11}; Lớp 12: ${grades.grade12}`;
}

export function normalizeLegacyMasterGpa(value: string) {
  if (!value || bachelorGpaPattern.test(value)) return "";
  return normalizeDecimal(value.replace(/\/\s*4(?:\.0)?$/i, "").trim());
}

function normalizeDecimal(value: string) {
  return value.replace(",", ".");
}
