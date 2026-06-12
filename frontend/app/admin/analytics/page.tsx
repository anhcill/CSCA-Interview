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
  const token = getAuthToken();

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<AdminStats>("/api/admin/stats", { token });
      setStats(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the tai analytics");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const cards = stats ? [
    { icon: User, label: "Tong user", value: stats.totalUsers, detail: `${stats.activeUsers} active, ${stats.inactiveUsers} khoa` },
    { icon: ClipboardList, label: "Tong session", value: stats.totalSessions, detail: `${stats.completedSessions} da hoan thanh` },
    { icon: Target, label: "Diem trung binh", value: formatScore(stats.avgScore), detail: "Session completed" },
    { icon: Brain, label: "Ngan hang cau hoi", value: stats.totalQuestions, detail: `${stats.activeQuestions} dang bat` },
    { icon: Activity, label: "AI call hom nay", value: stats.aiCallsToday, detail: "Request thanh cong" },
    { icon: BarChart3, label: "Admin accounts", value: stats.adminUsers, detail: "ADMIN va SUPER_ADMIN" }
  ] : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Admin analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Tong quan user, session, diem va cau hoi yeu.</p>
        </div>
        <button type="button" onClick={() => void loadStats()} disabled={loading} className="rounded-lg border px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">
          Refresh
        </button>
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
                <h2 className="text-sm font-bold">Cau hoi yeu</h2>
                <p className="text-xs text-slate-500">Sap xep theo diem trung binh thap nhat.</p>
              </div>
            </div>
            {stats.weakQuestions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Cau hoi</th>
                      <th className="px-4 py-3">Danh muc</th>
                      <th className="px-4 py-3">So lan tra loi</th>
                      <th className="px-4 py-3">Diem TB</th>
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
                <EmptyState title="Chua co du lieu yeu" description="Can co cau tra loi da cham diem de xep hang cau hoi yeu." />
              </div>
            )}
          </section>
        </>
      ) : (
        <EmptyState title="Khong co du lieu" description="Analytics chua tra ve du lieu." />
      )}
    </main>
  );
}

function formatScore(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(1);
}
