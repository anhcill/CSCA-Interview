export type UsageStatus = "success" | "error" | "unknown";

export type AiUsageLog = {
  costUsd: number | null;
  createdAt: string | null;
  errorMessage: string | null;
  id: string;
  inputTokens: number | null;
  latencyMs: number | null;
  model: string | null;
  operation: string | null;
  outputTokens: number | null;
  provider: string | null;
  status: UsageStatus;
  taskType: string | null;
  totalTokens: number | null;
  userEmail: string | null;
  userId: string | null;
  userName: string | null;
};

export type BreakdownItem = {
  avgLatencyMs: number | null;
  calls: number;
  costUsd: number;
  errorCalls: number;
  key: string;
  successCalls: number;
  tokens: number;
};

export type AiUsageSummary = {
  avgLatencyMs: number | null;
  byModel: BreakdownItem[];
  byProvider: BreakdownItem[];
  byTask: BreakdownItem[];
  errorCalls: number;
  successCalls: number;
  totalCalls: number;
  totalCostUsd: number;
  totalTokens: number;
};

export type LogsState = {
  logs: AiUsageLog[];
  page: number;
  total: number;
  totalPages: number;
};

export type QueryFilters = {
  from: string;
  limit: number;
  model: string;
  page: number;
  provider: string;
  status: string;
  taskType: string;
  to: string;
};

export const emptySummary: AiUsageSummary = {
  avgLatencyMs: null,
  byModel: [],
  byProvider: [],
  byTask: [],
  errorCalls: 0,
  successCalls: 0,
  totalCalls: 0,
  totalCostUsd: 0,
  totalTokens: 0
};

export const taskTypeOptions = [
  "GENERATE_QUESTIONS",
  "ANALYZE_STUDY_PLAN",
  "EXPLAIN_QUESTION",
  "SCORE_ANSWER",
  "GENERATE_REPORT",
  "IMPROVE_ANSWER"
] as const;

const taskTypeLabels: Record<string, string> = {
  ANALYZE_STUDY_PLAN: "Phân tích kế hoạch học tập",
  EXPLAIN_QUESTION: "Giải thích câu hỏi",
  GENERATE_QUESTIONS: "Tạo câu hỏi",
  GENERATE_REPORT: "Tạo báo cáo",
  IMPROVE_ANSWER: "Gợi ý cải thiện câu trả lời",
  SCORE_ANSWER: "Chấm điểm câu trả lời"
};

export function buildSummaryQuery(filters: QueryFilters) {
  return new URLSearchParams({
    from: filters.from,
    model: filters.model,
    provider: filters.provider,
    status: filters.status,
    taskType: filters.taskType,
    to: filters.to
  });
}

export function buildLogsQuery(filters: QueryFilters) {
  return new URLSearchParams({
    from: filters.from,
    to: filters.to,
    provider: filters.provider,
    model: filters.model,
    taskType: filters.taskType,
    status: filters.status,
    page: String(filters.page),
    limit: String(filters.limit)
  });
}

export function normalizeSummary(value: unknown): AiUsageSummary {
  const root = readRecord(value);
  const source = readRecord(root?.summary) ?? readRecord(root?.data) ?? root;
  if (!source) return emptySummary;
  const totals = readRecord(source.totals) ?? source;
  const breakdown = readRecord(source.breakdown) ?? source;
  const totalCalls = readNumber(totals.totalCalls) ?? readNumber(totals.calls) ?? readNumber(totals.requests) ?? readNumber(totals.total) ?? readNumber(totals.count) ?? 0;
  const errorCalls = readNumber(totals.errorCalls) ?? readNumber(totals.failedCalls) ?? readNumber(totals.failures) ?? readNumber(totals.errors) ?? 0;
  const successCalls = readNumber(totals.successCalls) ?? readNumber(totals.successfulCalls) ?? readNumber(totals.successes) ?? Math.max(0, totalCalls - errorCalls);

  return {
    avgLatencyMs: readNumber(totals.avgLatencyMs) ?? readNumber(totals.averageLatencyMs) ?? readNumber(totals.latencyMs) ?? readNumber(totals.avg_latency_ms),
    byModel: normalizeBreakdown(readUnknown(breakdown, ["byModel", "models", "modelBreakdown"]), "model"),
    byProvider: normalizeBreakdown(readUnknown(breakdown, ["byProvider", "providers", "providerBreakdown"]), "provider"),
    byTask: normalizeBreakdown(readUnknown(breakdown, ["byTask", "byTaskType", "tasks", "taskTypes", "taskBreakdown"]), "taskType"),
    errorCalls,
    successCalls,
    totalCalls,
    totalCostUsd: readNumber(totals.totalCostUsd) ?? readNumber(totals.costUsd) ?? readNumber(totals.cost_usd) ?? readNumber(totals.cost) ?? 0,
    totalTokens: readNumber(totals.totalTokens) ?? readNumber(totals.tokens) ?? readNumber(totals.total_tokens) ?? 0
  };
}

export function normalizeLogsResponse(value: unknown, fallbackPage: number): LogsState {
  const root = readRecord(value);
  const items = readArray(root?.data) ?? readArray(root?.logs) ?? readArray(root?.items) ?? readArray(value) ?? [];
  const meta = readRecord(root?.meta) ?? root;
  const total = readNumber(meta?.total) ?? readNumber(meta?.count) ?? items.length;
  const page = readNumber(meta?.page) ?? fallbackPage;
  const totalPages = readNumber(meta?.totalPages) ?? readNumber(meta?.pages) ?? Math.max(1, Math.ceil(total / Math.max(1, readNumber(meta?.limit) ?? 30)));

  return {
    logs: items.map((item, index) => normalizeLog(item, index)),
    page,
    total,
    totalPages
  };
}

export function buildBreakdownFromLogs(logs: AiUsageLog[], field: "model" | "provider" | "taskType"): BreakdownItem[] {
  const groups = new Map<string, BreakdownItem & { latencyCount: number; latencyTotal: number }>();

  logs.forEach((log) => {
    const key = log[field] ?? "Không rõ";
    const current = groups.get(key) ?? {
      avgLatencyMs: null,
      calls: 0,
      costUsd: 0,
      errorCalls: 0,
      key,
      latencyCount: 0,
      latencyTotal: 0,
      successCalls: 0,
      tokens: 0
    };

    current.calls += 1;
    current.tokens += log.totalTokens ?? 0;
    current.costUsd += log.costUsd ?? 0;
    if (log.status === "error") current.errorCalls += 1;
    if (log.status === "success") current.successCalls += 1;
    if (log.latencyMs != null) {
      current.latencyCount += 1;
      current.latencyTotal += log.latencyMs;
      current.avgLatencyMs = Math.round(current.latencyTotal / current.latencyCount);
    }
    groups.set(key, current);
  });

  return Array.from(groups.values()).sort((left, right) => right.calls - left.calls);
}

export function uniqueValues(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
}

export function taskLabel(value: string | null, operation?: string | null) {
  if (operation === "speech.transcribe") return "Speech: nhận dạng giọng nói";
  if (operation === "speech.synthesize") return "Speech: đọc câu hỏi";
  if (!value) return "Không rõ";
  return taskTypeLabels[value] ?? value;
}

export function formatNumber(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatUsd(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("vi-VN", {
    currency: "USD",
    maximumFractionDigits: 6,
    minimumFractionDigits: value > 0 && value < 0.01 ? 6 : 2,
    style: "currency"
  }).format(value);
}

export function formatLatency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${formatNumber(Math.round(value))} ms`;
}

export function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function normalizeLog(value: unknown, index: number): AiUsageLog {
  const source = readRecord(value) ?? {};
  const user = readRecord(source.user) ?? readRecord(source.users);
  const errorMessage = readString(source.errorMessage) ?? readString(source.error_message);
  const status = readStatus(source.status, errorMessage, source.success);

  return {
    costUsd: readNumber(source.costUsd) ?? readNumber(source.cost_usd),
    createdAt: readString(source.createdAt) ?? readString(source.created_at),
    errorMessage,
    id: readString(source.id) ?? `ai-usage-${index}`,
    inputTokens: readNumber(source.inputTokens) ?? readNumber(source.input_tokens),
    latencyMs: readNumber(source.latencyMs) ?? readNumber(source.latency_ms),
    model: readString(source.model),
    operation: readString(source.operation),
    outputTokens: readNumber(source.outputTokens) ?? readNumber(source.output_tokens),
    provider: readString(source.provider),
    status,
    taskType: readString(source.taskType) ?? readString(source.task_type),
    totalTokens: readNumber(source.totalTokens) ?? readNumber(source.total_tokens),
    userEmail: readString(source.userEmail) ?? readString(user?.email),
    userId: readString(source.userId) ?? readString(source.user_id) ?? readString(user?.id),
    userName: readString(source.userName) ?? readString(source.fullName) ?? readString(user?.fullName) ?? readString(user?.name)
  };
}

function normalizeBreakdown(value: unknown, keyField: string): BreakdownItem[] {
  const rawItems = readArray(value) ?? objectToBreakdownArray(value);
  return rawItems
    .map((item) => normalizeBreakdownItem(item, keyField))
    .filter((item): item is BreakdownItem => Boolean(item))
    .sort((left, right) => right.calls - left.calls);
}

function normalizeBreakdownItem(value: unknown, keyField: string): BreakdownItem | null {
  const source = readRecord(value);
  if (!source) return null;
  const key = readString(source.key) ?? readString(source.name) ?? readString(source.label) ?? readString(source[keyField]) ?? readString(source.value);
  if (!key) return null;
  const calls = readNumber(source.calls) ?? readNumber(source.totalCalls) ?? readNumber(source.requests) ?? readNumber(source.count) ?? readNumber(source.total) ?? 0;
  const errorCalls = readNumber(source.errorCalls) ?? readNumber(source.failedCalls) ?? readNumber(source.failures) ?? readNumber(source.errors) ?? 0;
  const successCalls = readNumber(source.successCalls) ?? readNumber(source.successfulCalls) ?? readNumber(source.successes) ?? Math.max(0, calls - errorCalls);

  return {
    avgLatencyMs: readNumber(source.avgLatencyMs) ?? readNumber(source.averageLatencyMs) ?? readNumber(source.avg_latency_ms) ?? readNumber(source.latencyMs),
    calls,
    costUsd: readNumber(source.costUsd) ?? readNumber(source.cost_usd) ?? readNumber(source.cost) ?? 0,
    errorCalls,
    key,
    successCalls,
    tokens: readNumber(source.tokens) ?? readNumber(source.totalTokens) ?? readNumber(source.total_tokens) ?? 0
  };
}

function objectToBreakdownArray(value: unknown): unknown[] {
  const source = readRecord(value);
  if (!source) return [];

  return Object.entries(source).map(([key, item]) => {
    const record = readRecord(item);
    if (record) return { key, ...record };
    return { calls: readNumber(item) ?? 0, key };
  });
}

function readUnknown(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (source[key] != null) return source[key];
  }
  return undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStatus(value: unknown, errorMessage: string | null, successValue: unknown): UsageStatus {
  if (errorMessage) return "error";
  if (typeof successValue === "boolean") return successValue ? "success" : "error";
  const status = readString(value)?.toLowerCase();
  if (!status) return "success";
  if (["success", "succeeded", "ok", "completed"].includes(status)) return "success";
  if (["error", "failed", "failure"].includes(status)) return "error";
  return "unknown";
}
