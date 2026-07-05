"use client";

import { Activity, AlertCircle, BarChart3, Bot, CheckCircle2, Clock3, Filter, Gauge, RefreshCw, Search, Timer, User, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
  buildBreakdownFromLogs,
  buildLogsQuery,
  buildSummaryQuery,
  emptySummary,
  errorMessage,
  formatDateTime,
  formatLatency,
  formatNumber,
  formatUsd,
  normalizeLogsResponse,
  normalizeSummary,
  taskLabel,
  taskTypeOptions,
  uniqueValues,
  type AiUsageSummary,
  type BreakdownItem,
  type LogsState,
  type QueryFilters,
  type UsageStatus
} from "@/components/admin/ai-usage-utils";

export function AiUsageDashboard() {
  const [summary, setSummary] = useState<AiUsageSummary>(emptySummary);
  const [logsState, setLogsState] = useState<LogsState>({ logs: [], page: 1, total: 0, totalPages: 1 });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [taskType, setTaskType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const token = getAuthToken();
  const debouncedProvider = useDebouncedValue(provider, 350);
  const debouncedModel = useDebouncedValue(model, 350);

  const filters = useMemo<QueryFilters>(() => ({
    from,
    limit,
    model: debouncedModel.trim(),
    page,
    provider: debouncedProvider.trim(),
    status,
    taskType,
    to
  }), [debouncedModel, debouncedProvider, from, limit, page, status, taskType, to]);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError("");

    const summaryPath = `/api/admin/ai-usage/summary?${buildSummaryQuery(filters).toString()}`;
    const logsPath = `/api/admin/ai-usage?${buildLogsQuery(filters).toString()}`;

    const [summaryResult, logsResult] = await Promise.allSettled([
      apiGet<unknown>(summaryPath, { cacheMs: 0, token }),
      apiGet<unknown>(logsPath, { cacheMs: 0, token })
    ]);

    const messages: string[] = [];

    if (summaryResult.status === "fulfilled") {
      setSummary(normalizeSummary(summaryResult.value));
    } else {
      setSummary(emptySummary);
      messages.push(errorMessage(summaryResult.reason, "Không thể tải tổng quan sử dụng AI"));
    }

    if (logsResult.status === "fulfilled") {
      setLogsState(normalizeLogsResponse(logsResult.value, filters.page));
    } else {
      setLogsState({ logs: [], page: filters.page, total: 0, totalPages: 1 });
      messages.push(errorMessage(logsResult.reason, "Không thể tải nhật ký sử dụng AI"));
    }

    setError(messages.join(" "));
    setLoading(false);
  }, [filters, token]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const providerBreakdown = summary.byProvider.length ? summary.byProvider : buildBreakdownFromLogs(logsState.logs, "provider");
  const modelBreakdown = summary.byModel.length ? summary.byModel : buildBreakdownFromLogs(logsState.logs, "model");
  const taskBreakdown = summary.byTask.length ? summary.byTask : buildBreakdownFromLogs(logsState.logs, "taskType");

  const providerOptions = useMemo(() => uniqueValues([
    ...providerBreakdown.map((item) => item.key),
    ...logsState.logs.map((log) => log.provider)
  ]), [logsState.logs, providerBreakdown]);

  const modelOptions = useMemo(() => uniqueValues([
    ...modelBreakdown.map((item) => item.key),
    ...logsState.logs.map((log) => log.model)
  ]), [logsState.logs, modelBreakdown]);

  const cards = [
    {
      detail: `${formatNumber(summary.successCalls)} thành công, ${formatNumber(summary.errorCalls)} lỗi`,
      icon: Activity,
      label: "Tổng lượt gọi",
      value: formatNumber(summary.totalCalls)
    },
    {
      detail: "Input, output và tổng token đã ghi nhận",
      icon: BarChart3,
      label: "Tổng token",
      value: formatNumber(summary.totalTokens)
    },
    {
      detail: "Chi phí ước tính theo nhật ký sử dụng",
      icon: Gauge,
      label: "Tổng chi phí",
      value: formatUsd(summary.totalCostUsd)
    },
    {
      detail: "Độ trễ trung bình của request",
      icon: Timer,
      label: "Latency TB",
      value: formatLatency(summary.avgLatencyMs)
    }
  ];

  function resetFilters() {
    setFrom("");
    setTo("");
    setProvider("");
    setModel("");
    setTaskType("");
    setStatus("");
    setPage(1);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
            <Bot size={24} />
            Theo dõi sử dụng AI
          </h1>
          <p className="mt-1 text-sm text-slate-500">Giám sát lượt gọi AI, tokens, chi phí, độ trễ và lỗi theo provider, model, tác vụ.</p>
        </div>
        <button type="button" onClick={() => void loadUsage()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={16} />
          Làm mới
        </button>
      </div>

      {error ? (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          <span>{error}</span>
        </p>
      ) : null}

      <section className="mb-5 rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Filter size={16} />
              Bộ lọc
            </h2>
            <p className="mt-1 text-xs text-slate-500">Tổng quan chỉ lọc theo ngày; bảng log lọc đầy đủ theo provider, model, tác vụ và trạng thái.</p>
          </div>
          <button type="button" onClick={resetFilters} className="min-h-9 rounded-lg border px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
            Xóa lọc
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[145px_145px_1fr_1fr_190px_150px_110px]">
          <label className="block text-xs font-bold text-slate-500">
            Từ ngày
            <input className="mt-1 min-h-10 w-full rounded-lg border px-3 text-sm text-slate-900" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          </label>
          <label className="block text-xs font-bold text-slate-500">
            Đến ngày
            <input className="mt-1 min-h-10 w-full rounded-lg border px-3 text-sm text-slate-900" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          </label>
          <label className="block text-xs font-bold text-slate-500">
            Provider
            <div className="mt-1 flex min-h-10 items-center gap-2 rounded-lg border px-3">
              <Search size={15} className="text-slate-400" />
              <input className="w-full border-0 text-sm outline-none" list="ai-usage-provider-options" placeholder="openai, 9router..." value={provider} onChange={(event) => { setProvider(event.target.value); setPage(1); }} />
              <datalist id="ai-usage-provider-options">
                {providerOptions.map((item) => <option key={item} value={item} />)}
              </datalist>
            </div>
          </label>
          <label className="block text-xs font-bold text-slate-500">
            Model
            <div className="mt-1 flex min-h-10 items-center gap-2 rounded-lg border px-3">
              <Search size={15} className="text-slate-400" />
              <input className="w-full border-0 text-sm outline-none" list="ai-usage-model-options" placeholder="gpt-4o, cx/gpt..." value={model} onChange={(event) => { setModel(event.target.value); setPage(1); }} />
              <datalist id="ai-usage-model-options">
                {modelOptions.map((item) => <option key={item} value={item} />)}
              </datalist>
            </div>
          </label>
          <label className="block text-xs font-bold text-slate-500">
            Tác vụ
            <select className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900" value={taskType} onChange={(event) => { setTaskType(event.target.value); setPage(1); }}>
              <option value="">Tất cả tác vụ</option>
              {taskTypeOptions.map((item) => <option key={item} value={item}>{taskLabel(item)}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-500">
            Trạng thái
            <select className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">Tất cả</option>
              <option value="success">Thành công</option>
              <option value="error">Lỗi</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-500">
            Dòng
            <select className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
              {[20, 30, 50, 100].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-lg border bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                      <p className="mt-2 break-words text-2xl font-black text-slate-950">{card.value}</p>
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      <Icon size={21} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{card.detail}</p>
                </div>
              );
            })}
          </section>

          <section className="mt-5 grid gap-4 xl:grid-cols-3">
            <BreakdownPanel items={providerBreakdown} title="Theo provider" valueLabel="Provider" />
            <BreakdownPanel items={modelBreakdown} title="Theo model" valueLabel="Model" />
            <BreakdownPanel items={taskBreakdown} title="Theo tác vụ" valueLabel="Tác vụ" formatKey={taskLabel} />
          </section>

          <section className="mt-5 overflow-hidden rounded-lg border bg-white">
            <div className="flex flex-col justify-between gap-2 border-b bg-slate-50 px-4 py-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-sm font-bold">Nhật ký sử dụng AI</h2>
                <p className="mt-1 text-xs text-slate-500">{formatNumber(logsState.total)} bản ghi phù hợp bộ lọc hiện tại.</p>
              </div>
              <div className="text-xs font-bold text-slate-500">Trang {logsState.page}/{Math.max(1, logsState.totalPages)}</div>
            </div>

            {logsState.logs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Người dùng</th>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Tác vụ</th>
                      <th className="px-4 py-3">Provider / Model</th>
                      <th className="px-4 py-3">Token</th>
                      <th className="px-4 py-3">Chi phí</th>
                      <th className="px-4 py-3">Độ trễ</th>
                      <th className="px-4 py-3">Trạng thái / lỗi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsState.logs.map((log) => (
                      <tr key={log.id} className="border-t align-top hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                              <User size={15} />
                            </div>
                            <div className="min-w-[180px]">
                              <span className="block font-bold text-slate-950">{log.userName ?? "Không rõ"}</span>
                              <span className="block text-xs text-slate-500">{log.userEmail ?? log.userId ?? "-"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">{taskLabel(log.taskType, log.operation)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-bold text-slate-950">{log.provider ?? "-"}</span>
                          <span className="block max-w-[260px] break-all font-mono text-xs text-slate-500">{log.model ?? "-"}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="block font-bold">{formatNumber(log.totalTokens)}</span>
                          <span className="block text-xs text-slate-500">Vào {formatNumber(log.inputTokens)} / Ra {formatNumber(log.outputTokens)}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold">{formatUsd(log.costUsd)}</td>
                        <td className="whitespace-nowrap px-4 py-3">{formatLatency(log.latencyMs)}</td>
                        <td className="min-w-[220px] px-4 py-3">
                          <StatusBadge status={log.status} />
                          {log.errorMessage ? <p className="mt-2 max-w-sm text-xs font-semibold text-red-700">{log.errorMessage}</p> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <EmptyState title="Chưa có nhật ký sử dụng AI" description="Bộ lọc hiện tại chưa có lượt gọi AI nào được ghi nhận." />
              </div>
            )}
          </section>

          {logsState.totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50">Trước</button>
              <span className="text-sm font-bold">{page}/{logsState.totalPages}</span>
              <button type="button" disabled={page >= logsState.totalPages} onClick={() => setPage((current) => Math.min(logsState.totalPages, current + 1))} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50">Sau</button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

function BreakdownPanel({
  formatKey,
  items,
  title,
  valueLabel
}: {
  formatKey?: (value: string | null) => string;
  items: BreakdownItem[];
  title: string;
  valueLabel: string;
}) {
  const maxCalls = Math.max(1, ...items.map((item) => item.calls));

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{valueLabel}, lượt gọi, token, chi phí và độ trễ.</p>
        </div>
        <Clock3 size={17} className="text-slate-400" />
      </div>
      {items.length ? (
        <div className="divide-y">
          {items.slice(0, 8).map((item) => {
            const width = Math.max(4, Math.round((item.calls / maxCalls) * 100));
            return (
              <div key={item.key} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">{formatKey ? formatKey(item.key) : item.key}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatNumber(item.tokens)} tokens · {formatUsd(item.costUsd)} · {formatLatency(item.avgLatencyMs)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black">{formatNumber(item.calls)}</p>
                    <p className="text-xs text-slate-500">{formatNumber(item.errorCalls)} lỗi</p>
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 text-sm text-slate-500">Chưa có dữ liệu breakdown.</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UsageStatus }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 size={13} />
        Thành công
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
        <XCircle size={13} />
        Lỗi
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
      <AlertCircle size={13} />
      Không rõ
    </span>
  );
}
