"use client";

import { RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

type AuditLog = {
  action: string;
  after_data?: unknown;
  before_data?: unknown;
  created_at: string;
  entity_id?: string | null;
  entity_type: string;
  id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  users?: { email: string; fullName: string; id: string } | null;
};

type AuditResponse = { data: AuditLog[]; page: number; total: number; totalPages: number };

const entityTypes = ["", "user", "question", "school", "major", "scholarship", "system_setting", "ai_prompt_template", "admission_season", "school_major", "school_scholarship"];

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const token = getAuthToken();
  const debouncedAction = useDebouncedValue(action, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "30", page: String(page) });
      if (debouncedAction) query.set("action", debouncedAction);
      if (entityType) query.set("entityType", entityType);
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      const response = await apiGet<AuditResponse>(`/api/admin/audit-logs?${query.toString()}`, { token });
      setLogs(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải nhật ký audit");
    } finally {
      setLoading(false);
    }
  }, [debouncedAction, entityType, from, page, to, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Nhật ký audit</h1>
          <p className="mt-1 text-sm text-slate-500">{total} thao tác admin</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={16} />
          Làm mới
        </button>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="mb-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[1fr_180px_150px_150px]">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3">
          <Search size={16} className="text-slate-400" />
          <input className="w-full border-0 text-sm outline-none" placeholder="Hành động..." value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} />
        </label>
        <select className="rounded-lg border px-3 py-2 text-sm" value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }}>
          {entityTypes.map((item) => <option key={item || "all"} value={item}>{item || "Tất cả đối tượng"}</option>)}
        </select>
        <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
        <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
      </section>

      <section className="overflow-hidden rounded-lg border bg-white">
        {loading ? (
          <div className="p-4"><ListSkeleton rows={8} /></div>
        ) : logs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Quản trị viên</th>
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Dữ liệu</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t align-top hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{log.users?.fullName ?? "-"}</span>
                      <span className="block text-xs text-slate-500">{log.users?.email ?? ""}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-indigo-700">{log.action}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{log.entity_type}</span>
                      <span className="block max-w-[160px] truncate font-mono text-xs text-slate-500">{log.entity_id ?? "-"}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.ip_address ?? "-"}</td>
                    <td className="px-4 py-3">
                      <details>
                        <summary className="cursor-pointer text-xs font-bold text-slate-600">JSON</summary>
                        <pre className="mt-2 max-h-64 max-w-xl overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-50">{JSON.stringify({ before: log.before_data, after: log.after_data }, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6"><EmptyState title="Không có nhật ký" description="Bộ lọc hiện tại chưa có thao tác nào." /></div>
        )}
      </section>

      {totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Trước</button>
          <span className="text-sm font-bold">{page}/{totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Sau</button>
        </div>
      ) : null}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
