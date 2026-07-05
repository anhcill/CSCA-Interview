import { ai_task_type, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

type QueryInput = Record<string, unknown>;
type AiUsageStatus = "SUCCESS" | "FAILED";

type NormalizedAiUsageFilters = {
  from: Date | null;
  model: string | null;
  provider: string | null;
  status: AiUsageStatus | null;
  taskType: ai_task_type | null;
  to: Date | null;
  userId: string | null;
};

type MetricsAggregate = {
  _avg: { latency_ms: number | null };
  _count: { id: number };
  _sum: {
    cost_usd: Prisma.Decimal | number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    total_tokens: number | null;
  };
};

type DayBreakdownRow = {
  avg_latency_ms: number | null;
  cost_usd: number | null;
  date: Date | string;
  failures: number;
  input_tokens: number | null;
  output_tokens: number | null;
  requests: number;
  successes: number;
  total_tokens: number | null;
};

export async function getAiUsageAdminList(query: QueryInput, pagination: { limit: number; skip: number }) {
  const filters = normalizeAiUsageFilters(query);
  const where = buildAiUsageWhere(filters);

  const [logs, total] = await Promise.all([
    prisma.ai_usage_logs.findMany({
      orderBy: { created_at: "desc" },
      select: {
        cost_usd: true,
        created_at: true,
        error_message: true,
        id: true,
        input_tokens: true,
        latency_ms: true,
        model: true,
        output_tokens: true,
        provider: true,
        request_payload: true,
        task_type: true,
        total_tokens: true,
        users: {
          select: {
            email: true,
            fullName: true,
            id: true
          }
        }
      },
      skip: pagination.skip,
      take: pagination.limit,
      where
    }),
    prisma.ai_usage_logs.count({ where })
  ]);

  return {
    rows: logs.map((log) => ({
      costUsd: toNumberOrNull(log.cost_usd),
      createdAt: log.created_at.toISOString(),
      errorMessage: log.error_message,
      id: log.id,
      inputTokens: log.input_tokens,
      latencyMs: log.latency_ms,
      operation: safeOperationFromPayload(log.request_payload),
      model: log.model,
      outputTokens: log.output_tokens,
      provider: log.provider,
      status: statusFromError(log.error_message),
      taskType: log.task_type,
      totalTokens: log.total_tokens,
      user: log.users ? {
        email: log.users.email,
        fullName: log.users.fullName,
        id: log.users.id
      } : null
    })),
    total
  };
}

export async function getAiUsageAdminSummary(query: QueryInput) {
  const filters = normalizeAiUsageFilters(query);
  const where = buildAiUsageWhere(filters);
  const dayWhereSql = buildDateWhereSql(filters);

  const [
    totals,
    successCount,
    failureCount,
    byProviderRows,
    byModelRows,
    byTaskRows,
    byUserRows,
    byDayRows
  ] = await Promise.all([
    prisma.ai_usage_logs.aggregate({
      _avg: { latency_ms: true },
      _count: { id: true },
      _sum: {
        cost_usd: true,
        input_tokens: true,
        output_tokens: true,
        total_tokens: true
      },
      where
    }),
    prisma.ai_usage_logs.count({ where: { ...where, error_message: null } }),
    prisma.ai_usage_logs.count({ where: { ...where, error_message: { not: null } } }),
    prisma.ai_usage_logs.groupBy({
      _avg: { latency_ms: true },
      _count: { id: true },
      _sum: {
        cost_usd: true,
        input_tokens: true,
        output_tokens: true,
        total_tokens: true
      },
      by: ["provider"],
      where
    }),
    prisma.ai_usage_logs.groupBy({
      _avg: { latency_ms: true },
      _count: { id: true },
      _sum: {
        cost_usd: true,
        input_tokens: true,
        output_tokens: true,
        total_tokens: true
      },
      by: ["provider", "model"],
      where
    }),
    prisma.ai_usage_logs.groupBy({
      _avg: { latency_ms: true },
      _count: { id: true },
      _sum: {
        cost_usd: true,
        input_tokens: true,
        output_tokens: true,
        total_tokens: true
      },
      by: ["task_type"],
      where
    }),
    prisma.ai_usage_logs.groupBy({
      _avg: { latency_ms: true },
      _count: { id: true },
      _sum: {
        cost_usd: true,
        input_tokens: true,
        output_tokens: true,
        total_tokens: true
      },
      by: ["user_id"],
      where
    }),
    prisma.$queryRaw<DayBreakdownRow[]>`
      SELECT
        date_trunc('day', created_at)::date AS date,
        COUNT(*)::int AS requests,
        COUNT(*) FILTER (WHERE error_message IS NULL)::int AS successes,
        COUNT(*) FILTER (WHERE error_message IS NOT NULL)::int AS failures,
        COALESCE(SUM(input_tokens), 0)::float AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::float AS output_tokens,
        COALESCE(SUM(total_tokens), 0)::float AS total_tokens,
        COALESCE(SUM(cost_usd), 0)::float AS cost_usd,
        AVG(latency_ms)::float AS avg_latency_ms
      FROM ai_usage_logs
      ${dayWhereSql}
      GROUP BY 1
      ORDER BY 1 ASC
    `
  ]);

  const userIds = Array.from(new Set(byUserRows.map((row) => row.user_id).filter((id): id is string => Boolean(id))));
  const users = userIds.length
    ? await prisma.user.findMany({
      select: { email: true, fullName: true, id: true },
      where: { id: { in: userIds } }
    })
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));

  return {
    byDay: byDayRows.map((row) => ({
      avgLatencyMs: toRoundedNumberOrNull(row.avg_latency_ms, 0),
      costUsd: toRoundedNumber(row.cost_usd, 6),
      date: formatDateOnly(row.date),
      failures: row.failures,
      inputTokens: toNumberOrZero(row.input_tokens),
      outputTokens: toNumberOrZero(row.output_tokens),
      requests: row.requests,
      successes: row.successes,
      totalTokens: toNumberOrZero(row.total_tokens)
    })),
    byModel: byModelRows.map((row) => ({
      ...mapMetrics(row),
      model: row.model,
      provider: row.provider
    })).sort(sortByRequestsDesc),
    byProvider: byProviderRows.map((row) => ({
      ...mapMetrics(row),
      provider: row.provider
    })).sort(sortByRequestsDesc),
    byTask: byTaskRows.map((row) => ({
      ...mapMetrics(row),
      taskType: row.task_type
    })).sort(sortByRequestsDesc),
    byUser: byUserRows.map((row) => {
      const user = row.user_id ? userById.get(row.user_id) ?? null : null;
      return {
        ...mapMetrics(row),
        user: user ? {
          email: user.email,
          fullName: user.fullName,
          id: user.id
        } : null,
        userId: row.user_id
      };
    }).sort(sortByRequestsDesc),
    filters: {
      from: filters.from?.toISOString() ?? null,
      to: filters.to?.toISOString() ?? null
    },
    totals: {
      ...mapMetrics(totals),
      failures: failureCount,
      successes: successCount
    }
  };
}

function normalizeAiUsageFilters(query: QueryInput): NormalizedAiUsageFilters {
  const taskType = parseTaskType(query.taskType);
  const userId = firstString(query.userId);

  return {
    from: parseDateBound(firstString(query.from), "from"),
    model: firstString(query.model),
    provider: firstString(query.provider),
    status: parseStatus(query.status),
    taskType,
    to: parseDateBound(firstString(query.to), "to"),
    userId: userId && isUuid(userId) ? userId : null
  };
}

function buildAiUsageWhere(filters: NormalizedAiUsageFilters): Prisma.ai_usage_logsWhereInput {
  const where: Prisma.ai_usage_logsWhereInput = {};

  if (filters.from || filters.to) {
    where.created_at = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {})
    };
  }

  if (filters.provider) where.provider = { equals: filters.provider, mode: "insensitive" };
  if (filters.model) where.model = { equals: filters.model, mode: "insensitive" };
  if (filters.taskType) where.task_type = filters.taskType;
  if (filters.userId) where.user_id = filters.userId;
  if (filters.status === "SUCCESS") where.error_message = null;
  if (filters.status === "FAILED") where.error_message = { not: null };

  return where;
}

function buildDateWhereSql(filters: NormalizedAiUsageFilters) {
  const conditions: Prisma.Sql[] = [];
  if (filters.from) conditions.push(Prisma.sql`created_at >= ${filters.from}`);
  if (filters.to) conditions.push(Prisma.sql`created_at <= ${filters.to}`);
  if (filters.provider) conditions.push(Prisma.sql`LOWER(provider) = LOWER(${filters.provider})`);
  if (filters.model) conditions.push(Prisma.sql`LOWER(model) = LOWER(${filters.model})`);
  if (filters.taskType) conditions.push(Prisma.sql`task_type = ${filters.taskType}::ai_task_type`);
  if (filters.userId) conditions.push(Prisma.sql`user_id = ${filters.userId}::uuid`);
  if (filters.status === "SUCCESS") conditions.push(Prisma.sql`error_message IS NULL`);
  if (filters.status === "FAILED") conditions.push(Prisma.sql`error_message IS NOT NULL`);

  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
}

function parseDateBound(value: string | null, bound: "from" | "to") {
  if (!value) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${bound === "from" ? "00:00:00.000" : "23:59:59.999"}Z`
    : value;
  const date = new Date(normalized);

  return Number.isFinite(date.getTime()) ? date : null;
}

function parseStatus(value: unknown): AiUsageStatus | null {
  const status = firstString(value)?.toUpperCase();
  if (!status) return null;
  if (["OK", "SUCCESS", "SUCCEEDED"].includes(status)) return "SUCCESS";
  if (["ERROR", "FAILED", "FAILURE"].includes(status)) return "FAILED";
  return null;
}

function parseTaskType(value: unknown): ai_task_type | null {
  const taskType = firstString(value)?.toUpperCase();
  if (!taskType) return null;
  return Object.values(ai_task_type).includes(taskType as ai_task_type) ? taskType as ai_task_type : null;
}

function firstString(value: unknown): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string") return null;
  const trimmed = first.trim();
  return trimmed ? trimmed : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function statusFromError(errorMessage: string | null): AiUsageStatus {
  return errorMessage == null ? "SUCCESS" : "FAILED";
}

function mapMetrics(row: MetricsAggregate) {
  return {
    avgLatencyMs: toRoundedNumberOrNull(row._avg.latency_ms, 0),
    costUsd: toRoundedNumber(row._sum.cost_usd, 6),
    inputTokens: toNumberOrZero(row._sum.input_tokens),
    outputTokens: toNumberOrZero(row._sum.output_tokens),
    requests: row._count.id,
    totalTokens: toNumberOrZero(row._sum.total_tokens)
  };
}

function safeOperationFromPayload(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.feature !== "speech") return null;
  return typeof record.operation === "string" ? record.operation : null;
}

function sortByRequestsDesc<T extends { requests: number }>(a: T, b: T) {
  return b.requests - a.requests;
}

function formatDateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toNumberOrNull(value: Prisma.Decimal | number | bigint | null | undefined) {
  if (value == null) return null;
  return Number(value);
}

function toNumberOrZero(value: Prisma.Decimal | number | bigint | null | undefined) {
  return toNumberOrNull(value) ?? 0;
}

function toRoundedNumber(value: Prisma.Decimal | number | bigint | null | undefined, digits: number) {
  const number = toNumberOrZero(value);
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function toRoundedNumberOrNull(value: Prisma.Decimal | number | bigint | null | undefined, digits: number) {
  const number = toNumberOrNull(value);
  if (number == null) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}
