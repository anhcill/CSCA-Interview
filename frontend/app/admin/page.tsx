"use client";

import { BarChart3, BookOpen, Bot, ClipboardList, GraduationCap, Upload, User } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";

type ActivityDay = {
  completed: number;
  date: string;
  sessions: number;
};

type AdminStats = {
  activeQuestions: number;
  activeUsers: number;
  activity7d: ActivityDay[];
  avgScore: number;
  completedSessions: number;
  totalQuestions: number;
  totalSessions: number;
  totalUsers: number;
};

type AdminUser = {
  _count: { interviewSessions: number };
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
};

type UsersResponse = { data: AdminUser[] };

const quickActions = [
  { href: "/admin/questions", icon: BookOpen, label: "Thêm câu hỏi", tone: "bg-red-600 text-white" },
  { href: "/admin/questions", icon: Upload, label: "Import Excel", tone: "bg-amber-400 text-slate-950" },
  { href: "/admin/ai-models", icon: Bot, label: "Model AI", tone: "bg-indigo-600 text-white" },
  { href: "/admin/audit", icon: ClipboardList, label: "Audit logs", tone: "bg-slate-800 text-white" },
  { href: "/admin/mappings", icon: GraduationCap, label: "Mapping tuyển sinh", tone: "bg-slate-800 text-white" }
] as const;

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const token = getAuthToken();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextStats, users] = await Promise.all([
        apiGet<AdminStats>("/api/admin/stats", { token }),
        apiGet<UsersResponse>("/api/admin/users?page=1&limit=5", { token })
      ]);
      setStats(nextStats);
      setRecentUsers(users.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dashboard quản trị");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const cards = stats ? [
    { detail: `${stats.activeUsers} active`, icon: User, label: "Tổng học viên", value: stats.totalUsers },
    { detail: `${stats.completedSessions} hoàn thành`, icon: ClipboardList, label: "Tổng phỏng vấn", value: stats.totalSessions },
    { detail: "Completed sessions", icon: BarChart3, label: "Điểm TB", value: formatScore(stats.avgScore) },
    { detail: `${stats.activeQuestions} đang bật`, icon: BookOpen, label: "Question bank", value: stats.totalQuestions }
  ] : [];
  const maxSessions = Math.max(1, ...(stats?.activity7d.map((day) => day.sessions) ?? [1]));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-slate-100 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-red-300">Admin command center</p>
          <h1 className="mt-2 text-3xl font-black text-white">Tổng quan hệ thống</h1>
          <p className="mt-2 text-sm font-semibold text-slate-400">Theo dõi học viên, phỏng vấn, điểm số và ngân hàng câu hỏi.</p>
        </div>
        <button type="button" onClick={() => void loadDashboard()} disabled={loading} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-700 px-4 text-sm font-black text-slate-100 hover:bg-slate-900 disabled:opacity-50">
          Refresh
        </button>
      </div>

      {error ? <p className="mb-4 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm font-bold text-red-100">{error}</p> : null}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : stats ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-400">{card.label}</p>
                      <p className="mt-2 text-3xl font-black text-white">{card.value}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-600/15 text-red-300">
                      <Icon size={22} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-500">{card.detail}</p>
                </div>
              );
            })}
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-white">Hoạt động 7 ngày</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Session tạo mới và session completed.</p>
                </div>
                <BarChart3 size={20} className="text-red-300" />
              </div>
              <div className="mt-6 flex h-56 items-end gap-3">
                {stats.activity7d.map((day) => {
                  const height = Math.max(10, Math.round((day.sessions / maxSessions) * 100));
                  return (
                    <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end rounded-lg bg-slate-950 px-2 pb-2">
                        <div className="w-full rounded-md bg-red-600" style={{ height: `${height}%` }} />
                      </div>
                      <p className="text-xs font-black text-white">{day.sessions}</p>
                      <p className="truncate text-[11px] font-semibold text-slate-500">{formatShortDate(day.date)}</p>
                      <p className="text-[11px] font-semibold text-green-300">{day.completed} done</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-sm font-black text-white">Quick actions</h2>
              <div className="mt-4 grid gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.label} href={action.href} className={`focus-ring flex min-h-12 items-center gap-3 rounded-lg px-4 text-sm font-black ${action.tone}`}>
                      <Icon size={18} />{action.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-sm font-black text-white">Học viên hoạt động gần đây</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">5 tài khoản mới nhất theo danh sách admin.</p>
              </div>
              <Link href="/admin/users" className="text-sm font-black text-red-300 hover:text-red-200">Xem tất cả</Link>
            </div>
            <div className="divide-y divide-slate-800">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-200">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="font-black text-white">{user.fullName}</p>
                      <p className="text-sm font-semibold text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">{user._count.interviewSessions} sessions</span>
                    <span className={`rounded px-2 py-1 ${user.isActive ? "bg-green-950 text-green-300" : "bg-red-950 text-red-300"}`}>
                      {user.isActive ? "Active" : "Locked"}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">{user.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function formatScore(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(1);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}
