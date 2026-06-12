"use client";

import { Activity, Award, BarChart3, Clock, Flame, Gauge, Play, Target, UserCheck } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { CountUp } from "@/components/ui/count-up";
import { Badge, Card, Progress, Skeleton } from "@/components/ui/primitives";
import { showToast } from "@/components/ui/toast";
import { apiGet, apiPut, createEventStream } from "@/lib/api";
import { getAuthToken, getStoredUser } from "@/lib/auth-client";
import { getStoredLocale, interpolate, localeChangedEvent, messages, type Locale } from "@/lib/i18n";

type Stats = {
  avgScore: number | null;
  badges?: { earned: boolean; icon: string; label: string }[];
  completedSessions: number;
  level?: string;
  preferences?: {
    browserNotificationsEnabled: boolean;
    onboardingCompleted: boolean;
    preferredLanguage: "EN" | "VI" | "ZH";
    theme: string;
    weeklyGoalTarget: number;
  };
  progress?: { label: string; score: number }[];
  recentSessions?: {
    answeredQuestions: number;
    createdAt: string;
    id: string;
    status: string;
    targetMajor: string | null;
    targetSchool: string | null;
    totalQuestions: number;
    totalScore: number | null;
  }[];
  skillAverages?: { content: number; expertise: number; language: number; logic: number; overall: number };
  streak?: number;
  totalSessions: number;
  weakAreas?: { category: string; score: number }[];
  weeklyGoal?: { completed: number; target: number };
  xp?: number;
};

type DashboardMessages = (typeof messages)["vi"]["dashboardPage"];

const onboardingKey = "ai_phongvan_onboarding_done";
const earnedBadgeKey = "ai_phongvan_earned_badges";
const reminderKey = "ai_phongvan_daily_reminder";

const ProgressLineChart = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((mod) => mod.ProgressLineChart),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false
  }
);

const SkillRadarMini = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((mod) => mod.SkillRadarMini),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false
  }
);

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [userName, setUserName] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [locale, setLocale] = useState<Locale>("vi");
  const [streamText, setStreamText] = useState("");

  useEffect(() => {
    const user = getStoredUser();
    setLocale(getStoredLocale());
    if (user?.fullName) setUserName(user.fullName);
    setShowOnboarding(localStorage.getItem(onboardingKey) !== "1");

    function handleLocaleChanged(event: Event) {
      const nextLocale = (event as CustomEvent<{ locale: Locale }>).detail?.locale;
      if (nextLocale) setLocale(nextLocale);
    }

    window.addEventListener(localeChangedEvent, handleLocaleChanged);

    async function loadStats() {
      try {
        const token = getAuthToken();
        if (!token) return;
        const nextStats = await apiGet<Stats>("/api/interviews/stats", { cacheMs: 30_000, token });
        const dashboardMessages = messages[getStoredLocale()].dashboardPage;
        setStats(nextStats);
        setShowOnboarding(!nextStats.preferences?.onboardingCompleted);
        notifyNewBadges(nextStats, dashboardMessages);
        maybeSendDailyReminder(nextStats, dashboardMessages);
      } catch {
        // dashboard stats are optional for first-time users
      }
    }

    loadStats();
    let stream: ReturnType<typeof createEventStream> | null = null;
    const streamTimer = window.setTimeout(() => {
      const message = encodeURIComponent(messages[getStoredLocale()].dashboardPage.realtimeMessage);
      stream = createEventStream(
        `/api/realtime/stream?message=${message}`,
        (token) => setStreamText((current) => `${current}${token}`)
      );
    }, 900);

    return () => {
      window.removeEventListener(localeChangedEvent, handleLocaleChanged);
      window.clearTimeout(streamTimer);
      stream?.close();
    };
  }, []);

  const t = messages[locale];
  const d = t.dashboardPage;
  const weeklyPercent = stats?.weeklyGoal ? Math.min(100, (stats.weeklyGoal.completed / stats.weeklyGoal.target) * 100) : 0;
  const profileCompleteness = useMemo(() => {
    if (!stats) return 35;
    return Math.min(100, 35 + stats.completedSessions * 12 + (stats.avgScore ? 18 : 0));
  }, [stats]);
  const skillAverages = stats?.skillAverages ?? { content: 0, expertise: 0, language: 0, logic: 0, overall: 0 };

  async function updatePreferences(input: Partial<NonNullable<Stats["preferences"]>>) {
    const token = getAuthToken();
    if (!token) return;
    const summary = await apiPut<{
      badges: Stats["badges"];
      preferences: NonNullable<Stats["preferences"]>;
      weeklyGoal: NonNullable<Stats["weeklyGoal"]>;
    }>("/api/gamification/preferences", input, { token });
    setStats((current) => current ? { ...current, badges: summary.badges, preferences: summary.preferences, weeklyGoal: summary.weeklyGoal } : current);
  }

  async function finishOnboarding() {
    localStorage.setItem(onboardingKey, "1");
    setShowOnboarding(false);
    await updatePreferences({ onboardingCompleted: true });
  }

  async function changeWeeklyGoal(nextTarget: number) {
    await updatePreferences({ weeklyGoalTarget: nextTarget });
  }

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    await updatePreferences({ browserNotificationsEnabled: permission === "granted" });
  }

  return (
    <main id="main-content" className="page-band min-h-screen text-foreground" tabIndex={-1} aria-label={t.dashboard}>
      <nav className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center text-lg font-black text-primary" aria-label={d.brandHomeAria}>
            {t.app.name}
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-slate-600 dark:text-slate-300 sm:block">
              {userName ? interpolate(d.hello, { name: userName }) : ""}
            </span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {showOnboarding ? (
          <section className="mb-6 animate-[fade-in_180ms_ease-out]">
            <Card className="border-blue-100 bg-white/95 dark:bg-slate-950">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className="type-caption text-primary">{d.onboardingEyebrow}</p>
                  <h2 className="type-title mt-2">{t.welcome}</h2>
                </div>
                <button type="button" onClick={finishOnboarding} className="focus-ring min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-black">
                  {d.gotIt}
                </button>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {d.onboardingSteps.map((item, index) => (
                  <div key={item} className="rounded-lg bg-blue-50 p-4 text-sm font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">{index + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="type-caption text-primary">{d.eyebrow}</p>
            <h1 className="type-display mt-2">{d.title}</h1>
            <p className="type-body mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
              {d.description}
            </p>
          </div>
          <Link
            href="/interview/setup"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-700"
            aria-label={t.quickStart}
          >
            <Play size={18} /> {t.quickStart}
          </Link>
        </header>

        <Card className="mb-5 bg-white/80 p-4 dark:bg-slate-950/80" aria-live="polite">
          <div className="flex items-center gap-3">
            <Activity className="text-emerald-500" size={18} />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{streamText || d.realtimeFallback}</p>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<BarChart3 size={19} />} label={d.totalSessions} value={stats?.totalSessions ?? 0} tone="primary" />
          <Metric icon={<Gauge size={19} />} label={d.averageScore} value={stats?.avgScore != null ? <><CountUp value={stats.avgScore} decimals={1} />/10</> : d.emptyScore} tone="warning" />
          <Metric icon={<Flame size={19} />} label={d.streak} value={<><CountUp value={stats?.streak ?? 0} /> {d.dayUnit}</>} tone="danger" />
          <Metric icon={<Award size={19} />} label={d.level} value={stats?.level ?? "Beginner"} tone="success" />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="type-caption text-primary">{d.progressEyebrow}</p>
                <h2 className="type-section mt-1">{d.progressTitle}</h2>
              </div>
              <Badge tone="primary">{stats?.completedSessions ?? 0} {d.completed}</Badge>
            </div>
            <ProgressLineChart data={stats?.progress ?? []} />
          </Card>

          <Card>
            <div className="mb-4">
              <p className="type-caption text-emerald-600">{d.skillEyebrow}</p>
              <h2 className="type-section mt-1">{d.skillTitle}</h2>
            </div>
            <SkillRadarMini data={skillAverages} />
          </Card>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card>
            <PanelTitle icon={<Target size={18} />} title={d.weeklyGoal} />
            <p className="mt-4 text-3xl font-black text-primary">{stats?.weeklyGoal?.completed ?? 0}/{stats?.weeklyGoal?.target ?? 3}</p>
            <Progress value={weeklyPercent} className="mt-4" />
            <div className="mt-4 flex items-center gap-2">
              {[3, 5, 7].map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => changeWeeklyGoal(target)}
                  className={`focus-ring min-h-11 rounded-lg border px-3 text-xs font-black ${stats?.weeklyGoal?.target === target ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200" : "border-border"}`}
                >
                  {interpolate(d.perWeek, { target })}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <PanelTitle icon={<UserCheck size={18} />} title={d.profileCompleteness} />
            <p className="mt-4 text-3xl font-black text-amber-600">{profileCompleteness}%</p>
            <Progress value={profileCompleteness} className="mt-4" />
          </Card>
          <Card>
            <PanelTitle icon={<Award size={18} />} title={d.xp} />
            <p className="mt-4 text-3xl font-black text-emerald-600">{stats?.xp ?? 0}</p>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Beginner {"->"} Intermediate {"->"} Advanced {"->"} Master</p>
            <button type="button" onClick={enableNotifications} className="focus-ring mt-4 min-h-11 rounded-lg border border-border px-3 text-xs font-black">
              {stats?.preferences?.browserNotificationsEnabled ? d.reminderOn : d.enableReminder}
            </button>
          </Card>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="type-section">{d.badges}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(stats?.badges?.length ? stats.badges : [{ earned: false, icon: "", label: d.noBadge }]).map((badge) => (
                <div key={badge.label} className={`rounded-lg border p-4 text-sm font-black ${badge.earned ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-900"}`}>
                  {badge.icon} {badge.label}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="type-section">{d.weakAreas}</h2>
            <div className="mt-4 space-y-3">
              {(stats?.weakAreas?.length ? stats.weakAreas : [{ category: d.noWeakAreas, score: 0 }]).map((area) => (
                <div key={area.category} className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-amber-800 dark:text-amber-100">{area.category}</p>
                    <span className="text-sm font-black text-amber-700 dark:text-amber-200">{area.score}/10</span>
                  </div>
                  <Progress value={area.score * 10} className="mt-3 bg-amber-100 dark:bg-amber-900" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="mt-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="type-section">{d.recentSessions}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{d.recentSessionsHelp}</p>
            </div>
            <Link href="/interview/history" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-black">
              {t.app.nav.history}
            </Link>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {(stats?.recentSessions?.length ? stats.recentSessions.slice(0, 6) : []).map((session) => (
              <article key={session.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="line-clamp-1 text-sm font-black text-slate-900 dark:text-white">{session.targetSchool ?? d.noRecentSessions}</p>
                    <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-500 dark:text-slate-400">{session.targetMajor ?? d.questions}</p>
                  </div>
                  <Badge tone={session.status === "COMPLETED" ? "success" : "warning"}>{session.status}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1"><Clock size={14} />{formatDashboardDate(session.createdAt, locale)}</span>
                  <span>{session.answeredQuestions}/{session.totalQuestions} {d.questions}</span>
                  <span>{d.averageScore}: {session.totalScore != null ? `${session.totalScore.toFixed(1)}/10` : d.emptyScore}</span>
                </div>
                <Link
                  href={session.status === "COMPLETED" ? `/interview/result?sessionId=${session.id}` : `/interview?sessionId=${session.id}`}
                  className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white text-sm font-black text-primary shadow-sm hover:bg-blue-50 dark:bg-slate-950 dark:hover:bg-slate-800"
                >
                  {session.status === "COMPLETED" ? d.viewReport : d.continue}
                </Link>
              </article>
            ))}
            {!stats?.recentSessions?.length ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500 lg:col-span-3 dark:border-slate-700">
                {d.noRecentSessions}
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </main>
  );
}

function Metric({
  icon,
  label,
  tone,
  value
}: {
  icon: React.ReactNode;
  label: string;
  tone: "danger" | "primary" | "success" | "warning";
  value: React.ReactNode;
}) {
  const tones = {
    primary: "text-blue-600 bg-blue-50 dark:bg-blue-950",
    warning: "text-amber-600 bg-amber-50 dark:bg-amber-950",
    success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950",
    danger: "text-red-600 bg-red-50 dark:bg-red-950"
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="type-caption text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </Card>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h2 className="type-section">{title}</h2>
    </div>
  );
}

function formatDashboardDate(value: string, locale: Locale) {
  const dateLocale = locale === "zh" ? "zh-CN" : locale === "en" ? "en-US" : "vi-VN";
  return new Intl.DateTimeFormat(dateLocale, {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function notifyNewBadges(stats: Stats, d: DashboardMessages) {
  const earned = (stats.badges ?? []).filter((badge) => badge.earned);
  const previous = new Set(JSON.parse(localStorage.getItem(earnedBadgeKey) ?? "[]") as string[]);
  const next = earned.map((badge) => badge.label);
  const newlyEarned = earned.filter((badge) => !previous.has(badge.label));

  if (newlyEarned.length) {
    newlyEarned.forEach((badge) => {
      showToast({
        description: interpolate(d.newBadgeDescription, { label: badge.label }),
        title: interpolate(d.newBadgeTitle, { icon: badge.icon, label: badge.label }),
        tone: "success"
      });
    });
  }

  localStorage.setItem(earnedBadgeKey, JSON.stringify(next));
}

function maybeSendDailyReminder(stats: Stats, d: DashboardMessages) {
  if (!stats.preferences?.browserNotificationsEnabled || typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(reminderKey) === today) return;

  const practicedToday = (stats.recentSessions ?? []).some((session) => {
    return session.status === "COMPLETED" && new Date(session.createdAt).toISOString().slice(0, 10) === today;
  });
  if (practicedToday) return;

  localStorage.setItem(reminderKey, today);
  new Notification(d.reminderTitle, {
    body: d.reminderDescription
  });
  showToast({
    description: d.reminderDescription,
    title: d.reminderTitle,
    tone: "info"
  });
}
