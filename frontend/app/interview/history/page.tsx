"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import Link from "next/link";

type SessionSummary = {
  id: string;
  mode: string;
  status: string;
  language: string;
  targetSchool: string | null;
  targetMajor: string | null;
  degreeLevel: string | null;
  totalQuestions: number;
  answeredQuestions: number;
  createdAt: string;
};
type SessionListResponse = { sessions: SessionSummary[]; page: number; totalPages: number; total: number };

const modeLabel: Record<string, string> = { PRACTICE: "Luyện tập", MOCK_TEST: "Thi thử", SCORING: "Chấm điểm" };
const statusLabel: Record<string, string> = { DRAFT: "Nháp", IN_PROGRESS: "Đang làm", COMPLETED: "Hoàn thành", CANCELLED: "Đã huỷ" };
const statusColor: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function InterviewHistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function load() {
      const token = getAuthToken();
      if (!token) { setError("Vui lòng đăng nhập"); setLoading(false); return; }
      try {
        const data = await apiGet<SessionListResponse>(`/api/interviews?page=${page}&limit=20`, { token });
        setSessions(data.sessions);
        setTotalPages(data.totalPages);
      } catch (e: any) { setError(e.message); }
      setLoading(false);
    }
    load();
  }, [page]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Dashboard</Link>
          <h1 className="text-2xl font-bold mt-1">Lịch sử phỏng vấn</h1>
          <p className="text-sm text-slate-500 mt-1">{sessions.length} buổi luyện</p>
        </div>
        <Link href="/interview/setup" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
          + Phỏng vấn mới
        </Link>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700 text-sm">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-slate-400">Đang tải...</p>
      ) : sessions.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg text-slate-400">Chưa có buổi phỏng vấn nào</p>
          <Link href="/interview/setup" className="mt-4 inline-block rounded bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700">
            Bắt đầu luyện tập
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <Link key={s.id} href={s.status === "COMPLETED" ? `/interview/result?sessionId=${s.id}` : `/interview?sessionId=${s.id}`}
              className="block rounded-xl border bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{modeLabel[s.mode] || s.mode}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[s.status] || "bg-slate-100"}`}>
                      {statusLabel[s.status] || s.status}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{s.language}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                    {s.targetSchool && <span>🏫 {s.targetSchool}</span>}
                    {s.targetMajor && <span>📚 {s.targetMajor}</span>}
                    {s.degreeLevel && <span>🎓 {s.degreeLevel === "BACHELOR" ? "Đại học" : "Thạc sĩ"}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">{s.answeredQuestions}/{s.totalQuestions} câu</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(s.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            </Link>
          ))}
          <div className="flex items-center justify-end gap-2 pt-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Prev</button>
            <span className="text-sm font-bold">{page}/{totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </main>
  );
}
