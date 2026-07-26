export type ParsedInterviewSheetQuestion = {
  category?: "PERSONAL" | "ACADEMIC" | "STUDY_PLAN" | "SCHOLARSHIP" | "CAREER_PLAN" | "LANGUAGE" | "SITUATION" | "RESEARCH" | "SCHOOL_MAJOR" | "OTHER";
  commonMistakes?: string | null;
  degreeLevel: "BACHELOR" | "MASTER";
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  keywords?: string | null;
  language: "VI" | "ZH" | "EN";
  majorName: string | null;
  questionCode?: string | null;
  questionText: string;
  sampleAnswer?: string | null;
  scoringRubric?: unknown | null;
  schoolName: string;
  sourceColumn: number;
  sourceColumnName?: string | null;
  sourceRow: number;
  suggestedAnswerLogic?: string | null;
};

export type ParsedInterviewSheet = {
  questions: ParsedInterviewSheetQuestion[];
  stats: {
    blocks: number;
    majors: number;
    questions: number;
    schools: number;
  };
  warnings: Array<{
    message: string;
    preview?: string;
    sourceColumn?: number;
    sourceRow?: number;
  }>;
};

export function parseInterviewSheetCsv(csv: string): ParsedInterviewSheet {
  const rows = parseCsvRows(csv);
  const questions: ParsedInterviewSheetQuestion[] = [];
  const warnings: ParsedInterviewSheet["warnings"] = [];
  let currentSchoolName = "";
  let blockCount = 0;

  rows.forEach((row, rowIndex) => {
    const schoolCell = cleanCell(row[1] ?? "");
    if (schoolCell) currentSchoolName = normalizeSchoolName(schoolCell);

    const degreeLevel = normalizeDegreeLevel(row[2] ?? "");
    if (!currentSchoolName || !degreeLevel) return;

    row.slice(3).forEach((rawBlock, blockIndex) => {
      const block = cleanCell(rawBlock ?? "");
      if (!block) return;

      blockCount += 1;
      const sourceColumn = blockIndex + 4;
      const sourceRow = rowIndex + 1;
      const majorName = extractMajorName(block);
      const extractedQuestions = extractQuestionsFromBlock(block);

      if (!extractedQuestions.length) {
        warnings.push({
          message: "Không tách được câu hỏi từ ô dữ liệu.",
          preview: block.slice(0, 160),
          sourceColumn,
          sourceRow
        });
      }

      extractedQuestions.forEach((questionText) => {
        questions.push({
          degreeLevel,
          language: inferLanguage(questionText),
          majorName,
          questionText,
          schoolName: currentSchoolName,
          sourceColumn,
          sourceRow
        });
      });
    });
  });

  return {
    questions,
    stats: {
      blocks: blockCount,
      majors: new Set(questions.map((question) => question.majorName).filter(Boolean)).size,
      questions: questions.length,
      schools: new Set(questions.map((question) => question.schoolName)).size
    },
    warnings
  };
}

export function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSchoolLookupKey(value: string) {
  return normalizeLookupText(value)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\uFF08[^\uFF09]*\uFF09/g, " ")
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, " ")
    .replace(/\b(dh|dai hoc|university)\b/g, "dai hoc")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeQuestionLookupKey(value: string) {
  return normalizeLookupText(value)
    .replace(/[^\p{L}\p{N}\u3400-\u9fff]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsvRows(csv: string) {
  const normalized = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(cleanCell(cell));
      cell = "";
    } else if (char === "\n") {
      row.push(cleanCell(cell));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cleanCell(cell));
    rows.push(row);
  }

  return rows;
}

function cleanCell(value: string) {
  return value.replace(/\u00a0/g, " ").trim();
}

function normalizeSchoolName(value: string) {
  return value.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeDegreeLevel(value: string): ParsedInterviewSheetQuestion["degreeLevel"] | null {
  const normalized = normalizeLookupText(value);
  if (normalized.includes("thac")) return "MASTER";
  if (normalized.includes("dai hoc")) return "BACHELOR";
  return null;
}

function extractMajorName(block: string) {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8);

  for (const line of lines) {
    const normalizedLine = normalizeLookupText(line);
    const majorIndex = normalizedLine.indexOf("nganh ");
    if (majorIndex < 0) continue;

    const tail = line.slice(majorIndex + "nganh ".length).trim();
    const cleaned = tail
      .replace(/[-–—].*$/, "")
      .replace(/[\]()（）:].*$/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned) return cleaned;
  }

  return null;
}

function extractQuestionsFromBlock(block: string) {
  const lines = block
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const questions: string[] = [];
  let current: string | null = null;

  const pushCurrent = () => {
    if (current?.trim()) questions.push(current.trim());
    current = null;
  };

  for (const rawLine of lines) {
    const lineWithoutPrefix = stripQuestionPrefix(rawLine);
    if (isTranslationLine(lineWithoutPrefix) && current) {
      current = `${current}\n${lineWithoutPrefix}`;
      continue;
    }
    if (isSectionHeader(lineWithoutPrefix)) continue;

    const inlineParts = splitInlineQuestions(lineWithoutPrefix);
    let pendingContext = "";

    inlineParts.forEach((part, partIndex) => {
      const clean = stripQuestionPrefix(part);
      if (!clean || /^[)\]\uFF09]+$/.test(clean)) return;
      if (isBracketedContinuation(clean) && current) {
        current = `${current} ${clean}`;
        return;
      }

      const enumerated = rawLine !== lineWithoutPrefix || startsWithQuestionPrefix(rawLine);
      const signal = hasQuestionSignal(clean);
      const contextBeforeQuestion = partIndex < inlineParts.length - 1
        && hasHanText(clean)
        && !/[?\uFF1F]/u.test(clean)
        && !enumerated;

      if (contextBeforeQuestion) {
        pendingContext = pendingContext ? `${pendingContext}\n${clean}` : clean;
        return;
      }

      if (isHeading(clean) && !signal) return;

      if ((enumerated && partIndex === 0) || signal) {
        pushCurrent();
        current = pendingContext ? `${pendingContext}\n${clean}` : clean;
        pendingContext = "";
        return;
      }

      if (current && isLikelyContinuation(clean)) {
        current = `${current}\n${clean}`;
      }
    });
  }

  pushCurrent();

  const deduped = new Map<string, string>();
  questions
    .map((question) => question.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim())
    .filter((question) => question.length >= 3)
    .forEach((question) => {
      deduped.set(normalizeQuestionLookupKey(question), question);
    });

  return Array.from(deduped.values());
}

function stripQuestionPrefix(line: string) {
  return line
    .replace(/^\s*(?:\(?\d+\)?[.\u3001,)\uFF0E:\uFF1A]?|[+*\u2022-]|C\d+[:\uFF1A.]?)\s*/i, "")
    .trim();
}

function startsWithQuestionPrefix(line: string) {
  return /^\s*(?:\(?\d+\)?[.\u3001,)\uFF0E:\uFF1A]?|[+*\u2022-]|C\d+[:\uFF1A.]?)\s*/i.test(line);
}

function isTranslationLine(line: string) {
  return /^(?:\u2192|->)/u.test(line);
}

function isSectionHeader(line: string) {
  const normalized = normalizeLookupText(line);
  return /^(?:phan|phan ket|phan mo dau|phan khong luong truoc duoc)[:\uFF1A]?\s*/i.test(normalized);
}

function splitInlineQuestions(line: string) {
  if (line.includes("\u2192") || line.includes("->")) return [line];
  if (!/[\u3002\uFF1F\uFF01?]/u.test(line)) return [line];

  const parts = line.match(/[^\u3002\uFF1F\uFF01?]+[\u3002\uFF1F\uFF01?]?/gu)
    ?.map((part) => part.trim())
    .filter(Boolean);
  return parts?.length ? parts : [line];
}

function isBracketedContinuation(line: string) {
  return /^[(\uFF08]/u.test(line);
}

function isHeading(line: string) {
  const normalized = normalizeLookupText(line).replace(/^[^a-z0-9]+/i, "").trim();
  if (!line) return true;
  if (/^[[\]().:\uFF1A\s-]+$/u.test(line)) return true;
  return /^(phan|thay|co\s*\d*:|giam khao|nganh|hoc bong|bai thi|professional|thoi gian|ket|pv\b|phong van|he\b|csc\b|cis\b|thac\b|dai hoc\b)/i.test(normalized);
}

function hasQuestionSignal(line: string) {
  const normalized = normalizeLookupText(line);
  if (/[?\uFF1F]/u.test(line)) return true;
  if (hasHanText(line) && !isHeading(line) && line.length <= 220) return true;

  return /^(vi sao|tai sao|hay|ban|em|neu|sau khi|ke|gioi thieu|ly do|dinh huong|hieu|phan tich|so sanh|doc|tu gioi thieu|what|why|how|could|please|if|tell|do you|can you|would you|lieu ke|su phat trien|mang xa hoi)/i.test(normalized);
}

function isLikelyContinuation(line: string) {
  return /^(va|hoac|theo|roi|sau do|do|because|where|when|which)/i.test(normalizeLookupText(line));
}

function hasHanText(line: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/u.test(line);
}

function inferLanguage(questionText: string): ParsedInterviewSheetQuestion["language"] {
  if (hasHanText(questionText)) return "ZH";

  const normalized = normalizeLookupText(questionText);
  if (/^(what|why|how|could|please|if|tell|do you|can you|would you|which|where|when)\b/.test(normalized)) {
    return "EN";
  }

  return "VI";
}
