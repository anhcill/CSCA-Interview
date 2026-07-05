"use client";

import { Activity, BarChart3, Brain, ClipboardList, Target, User } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";

type WeakQuestion = {
  attempts: number;
  avgScore: number;
  category?: string | null;
  questionId?: string | null;
  questionText: string;
};

type AdminStats = {
  activeQuestions: number;
  activeUsers: number;
  adminUsers: number;
  aiCallsToday: number;
  aiCostUsd: number;
  aiTokens: number;
  avgScore: number;
  completedSessions: number;
  inactiveUsers: number;
  totalQuestions: number;
  totalSessions: number;
  totalUsers: number;
  weakQuestions: WeakQuestion[];
};

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const token = getAuthToken();

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await apiGet<AdminStats>(`/api/admin/stats${suffix}`, { token });
      setStats(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải phân tích");
    } finally {
      setLoading(false);
    }
  }, [from, to, token]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const cards = stats ? [
    { icon: User, label: "Tổng người dùng", value: stats.totalUsers, detail: `${stats.activeUsers} đang hoạt động, ${stats.inactiveUsers} khóa` },
    { icon: ClipboardList, label: "Tổng buổi", value: stats.totalSessions, detail: `${stats.completedSessions} đã hoàn thành` },
    { icon: Target, label: "Điểm trung bình", value: formatScore(stats.avgScore), detail: "Buổi đã hoàn thành" },
    { icon: Brain, label: "Ngân hàng câu hỏi", value: stats.totalQuestions, detail: `${stats.activeQuestions} đang bật` },
    { icon: Activity, label: "Lượt gọi AI", value: stats.aiCallsToday, detail: "Request thành công" },
    { icon: BarChart3, label: "AI tokens", value: stats.aiTokens, detail: `$${stats.aiCostUsd.toFixed(4)}` },
    { icon: BarChart3, label: "Tài khoản admin", value: stats.adminUsers, detail: "ADMIN và SUPER_ADMIN" }
  ] : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Phân tích admin</h1>
          <p className="mt-1 text-sm text-slate-500">Tổng quan người dùng, buổi phỏng vấn, điểm và câu hỏi yếu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-h-10 rounded-lg border px-3 text-sm" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="min-h-10 rounded-lg border px-3 text-sm" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <button type="button" onClick={() => void loadStats()} disabled={loading} className="rounded-lg border px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">
            Làm mới
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : stats ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-lg border bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                      <p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      <Icon size={21} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{card.detail}</p>
                </div>
              );
            })}
          </section>

          <section className="mt-6 rounded-lg border bg-white">
            <div className="flex flex-col justify-between gap-2 border-b bg-slate-50 px-4 py-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-sm font-bold">Câu hỏi yếu</h2>
                <p className="text-xs text-slate-500">Sắp xếp theo điểm trung bình thấp nhất.</p>
              </div>
            </div>
            {stats.weakQuestions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Câu hỏi</th>
                      <th className="px-4 py-3">Danh mục</th>
                      <th className="px-4 py-3">Số lần trả lời</th>
                      <th className="px-4 py-3">Điểm TB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.weakQuestions.map((question) => (
                      <tr key={`${question.questionId ?? question.questionText}`} className="border-t hover:bg-slate-50">
                        <td className="max-w-3xl px-4 py-3 font-medium">{question.questionText}</td>
                        <td className="px-4 py-3 text-slate-500">{question.category || "-"}</td>
                        <td className="px-4 py-3">{question.attempts}</td>
                        <td className="px-4 py-3 font-bold text-red-700">{formatScore(question.avgScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <EmptyState title="Chưa có dữ liệu yếu" description="Cần có câu trả lời đã chấm điểm để xếp hạng câu hỏi yếu." />
              </div>
            )}
          </section>
        </>
      ) : (
        <EmptyState title="Không có dữ liệu" description="Analytics chưa trả về dữ liệu." />
      )}
    </main>
  );
}

function formatScore(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(1);
}
