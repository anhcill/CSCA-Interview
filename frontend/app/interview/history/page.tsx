"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, Clock, GraduationCap, Plus, School, Trash2, type LucideIcon } from "lucide-react";
// @ts-expect-error - Framer Motion v12 type resolution workaround
import { AnimatePresence, motion } from "motion/react";
import { apiDelete, apiGet } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";

type SessionSummary = {
  answeredQuestions: number;
  createdAt: string;
  degreeLevel: string | null;
  id: string;
  language: string;
  mode: string;
  plannedDurationMinutes: number | null;
  status: string;
  targetMajor: string | null;
  targetSchool: string | null;
  totalQuestions: number;
};

type SessionListResponse = {
  sessions: SessionSummary[];
  page: number;
  totalPages: number;
  total: number;
};

type MajorGroup = {
  completed: number;
  key: string;
  latestAt: string;
  sessions: SessionSummary[];
  title: string;
  total: number;
};

const modeLabel: Record<string, string> = { MOCK_TEST: "Thi thử", PRACTICE: "Luyện tập", SCORING: "Chấm điểm" };
const statusLabel: Record<string, string> = { CANCELLED: "Đã huỷ", COMPLETED: "Hoàn thành", DRAFT: "Nháp", IN_PROGRESS: "Đang làm", PAUSED: "Tạm dừng" };
const statusColor: Record<string, string> = {
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  IN_PROGRESS: "border-primary/20 bg-primary/10 text-primary",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-700"
};

function formatDuration(minutes: number | null) {
  if (!minutes) return "Chưa đặt";
  if (minutes === 60) return "1h";
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}p`;
  return `${minutes}p`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function groupByMajor(sessions: SessionSummary[]): MajorGroup[] {
  const map = new Map<string, SessionSummary[]>();

  sessions.forEach((session) => {
    const title = session.targetMajor?.trim() || "Chưa chọn ngành";
    const key = title.toLocaleLowerCase("vi-VN");
    map.set(key, [...(map.get(key) ?? []), session]);
  });

  return [...map.entries()]
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return {
        completed: sorted.filter((item) => item.status === "COMPLETED").length,
        key,
        latestAt: sorted[0]?.createdAt ?? "",
        sessions: sorted,
        title: sorted[0]?.targetMajor?.trim() || "Chưa chọn ngành",
        total: sorted.length
      };
    })
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

export default function InterviewHistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedMajorKey, setSelectedMajorKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const groups = useMemo(() => groupByMajor(sessions), [sessions]);
  const selectedGroup = groups.find((group) => group.key === selectedMajorKey) ?? groups[0] ?? null;
  const totalCompleted = sessions.filter((session) => session.status === "COMPLETED").length;

  useEffect(() => {
    async function load() {
      const token = getAuthToken();
      if (!token) {
        setError("Vui lòng đăng nhập");
        setLoading(false);
        return;
      }

      try {
        const data = await apiGet<SessionListResponse>("/api/interviews?page=1&limit=100", { cacheMs: 0, token });
        setSessions(data.sessions);
        setSelectedMajorKey((current) => current || groupByMajor(data.sessions)[0]?.key || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được lịch sử phỏng vấn");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (!groups.length) {
      if (selectedMajorKey) setSelectedMajorKey("");
      return;
    }

    if (!groups.some((group) => group.key === selectedMajorKey)) {
      setSelectedMajorKey(groups[0].key);
    }
  }, [groups, selectedMajorKey]);

  function handleDeleteClick(sessionId: string) {
    setSessionToDelete(sessionId);
  }

  async function confirmDelete() {
    if (!sessionToDelete) return;
    const sessionId = sessionToDelete;
    const token = getAuthToken();
    if (!token) {
      setError("Vui lòng đăng nhập");
      setSessionToDelete(null);
      return;
    }

    setDeletingId(sessionId);
    setError("");
    setSessionToDelete(null);

    try {
      await apiDelete<{ message: string }>(`/api/interviews/${sessionId}`, { token });
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được lịch sử");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="page-band min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-[1600px] flex-col">
        <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 lg:flex-row lg:items-end">
          <div>
            <Link href="/dashboard" className="focus-ring inline-flex min-h-9 items-center text-sm font-black text-primary hover:underline">
              ← Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-black">Lịch sử phỏng vấn</h1>
            <p className="mt-2 text-sm font-bold text-muted-foreground">
              {sessions.length} buổi luyện · {groups.length} ngành · {totalCompleted} buổi hoàn thành
            </p>
          </div>
          <Link href="/interview/setup" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-black text-primary-foreground shadow-[0_14px_32px_rgba(184,29,36,0.18)]">
            <Plus size={17} />
            Phỏng vấn mới
          </Link>
        </header>

        {error ? <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}

        {loading ? (
          <div className="grid flex-1 place-items-center text-sm font-bold text-muted-foreground">Đang tải lịch sử...</div>
        ) : sessions.length === 0 ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <p className="text-lg font-black text-muted-foreground">Chưa có buổi phỏng vấn nào</p>
              <Link href="/interview/setup" className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-black text-primary-foreground">
                Bắt đầu luyện tập
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid flex-1 min-h-0 gap-5 lg:grid-cols-[360px_1fr]">
            <aside className="min-h-0 overflow-auto rounded-lg border border-border bg-background p-3 shadow-[var(--shadow-ui)]">
              <p className="px-2 py-2 text-xs font-black uppercase tracking-wide text-primary">Ngành phỏng vấn</p>
              <div className="mt-2 grid gap-2">
                {groups.map((group) => {
                  const active = selectedGroup?.key === group.key;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setSelectedMajorKey(group.key)}
                      className={`focus-ring flex min-h-20 items-center justify-between gap-3 rounded-lg border px-4 text-left transition ${
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{group.title}</span>
                        <span className={`mt-1 block text-xs font-bold ${active ? "text-white/72" : "text-muted-foreground"}`}>
                          {group.total} buổi · {group.completed} hoàn thành
                        </span>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="min-h-0 overflow-hidden rounded-lg border border-border bg-background shadow-[var(--shadow-ui)]">
              <div className="flex flex-col justify-between gap-3 border-b border-border bg-primary/5 px-5 py-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-primary">Danh sách lịch sử</p>
                  <h2 className="mt-1 text-xl font-black">{selectedGroup?.title}</h2>
                </div>
                <p className="text-sm font-bold text-muted-foreground">{selectedGroup?.sessions.length ?? 0} buổi</p>
              </div>

              <div className="max-h-[calc(100vh-15rem)] overflow-auto p-4">
                <div className="grid gap-3">
                  {(selectedGroup?.sessions ?? []).map((session) => (
                    <article key={session.id} className="rounded-lg border border-border bg-background p-4 transition hover:border-primary/35 hover:shadow-sm">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <Link
                          href={session.status === "COMPLETED" ? `/interview/result?sessionId=${session.id}` : `/interview?sessionId=${session.id}`}
                          className="focus-ring min-w-0 flex-1 rounded-lg"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-black">{modeLabel[session.mode] || session.mode}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-black ${statusColor[session.status] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {statusLabel[session.status] || session.status}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-black text-muted-foreground">{session.language}</span>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm font-bold text-muted-foreground md:grid-cols-3">
                            {session.targetSchool ? <Meta icon={School} text={session.targetSchool} /> : null}
                            {session.targetMajor ? <Meta icon={BookOpen} text={session.targetMajor} /> : null}
                            {session.degreeLevel ? <Meta icon={GraduationCap} text={session.degreeLevel === "BACHELOR" ? "Đại học" : "Thạc sĩ"} /> : null}
                            <Meta icon={Clock} text={`Thời lượng: ${formatDuration(session.plannedDurationMinutes)}`} />
                          </div>
                        </Link>

                        <div className="flex shrink-0 items-center justify-between gap-4 xl:justify-end">
                          <div className="text-left xl:text-right">
                            <p className="text-sm font-black">{session.answeredQuestions}/{session.totalQuestions} câu</p>
                            <p className="mt-1 text-xs font-bold text-muted-foreground">{formatDate(session.createdAt)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(session.id)}
                            disabled={deletingId === session.id}
                            className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                            aria-label="Xóa lịch sử phỏng vấn"
                            title="Xóa lịch sử"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </section>
      <AnimatePresence>
        {sessionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSessionToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-border bg-background p-6 shadow-2xl"
            >
              <h3 className="text-xl font-black text-foreground">Xác nhận xóa lịch sử</h3>
              <p className="mt-3 text-sm font-semibold text-muted-foreground leading-6">
                Bạn có chắc chắn muốn xóa buổi phỏng vấn này khỏi lịch sử? Hành động này sẽ không thể hoàn tác và toàn bộ dữ liệu liên quan sẽ bị loại bỏ.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSessionToDelete(null)}
                  className="focus-ring min-h-11 rounded-xl border border-border bg-background px-5 text-sm font-black text-foreground hover:bg-muted transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="focus-ring min-h-11 rounded-xl bg-red-600 hover:bg-red-700 px-5 text-sm font-black text-white shadow-lg shadow-red-950/20 transition"
                >
                  Đồng ý xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Meta({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="shrink-0 text-primary" size={15} />
      <span className="truncate">{text}</span>
    </span>
  );
}
