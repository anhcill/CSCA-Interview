"use client";

import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  BookOpenCheck,
  Calendar,
  Check,
  ChevronRight,
  AlertCircle,
  Clock3,
  FileText,
  Flame,
  Gauge,
  History,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CountUp } from "@/components/ui/count-up";
import { InlineSystemLoading } from "@/components/ui/system-loading";
import { Badge, Card, Progress, Skeleton } from "@/components/ui/primitives";
import { showToast } from "@/components/ui/toast";
import { apiGet, apiPut, createEventStream } from "@/lib/api";
import { getAuthToken, getStoredUser } from "@/lib/auth-client";
import { getStoredLocale, interpolate, localeChangedEvent, messages, type Locale } from "@/lib/i18n";
import { fetchMyProfile, type UserProfileDto } from "@/lib/profile-client";
import {
  buildSevenDayPlan,
  findResumableSession,
  getPriorityWeakAreas,
  getProfileCompleteness,
  getReadinessScore,
  getScoreTrend,
  type DashboardRecentSession,
  type DashboardWeakArea
} from "./dashboard-insights";

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
  recentSessions?: DashboardRecentSession[];
  skillAverages?: { content: number; expertise: number; language: number; logic: number; overall: number };
  streak?: number;
  totalSessions: number;
  weakAreas?: DashboardWeakArea[];
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);

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
        const [nextStats, profileResult] = await Promise.all([
          apiGet<Stats>("/api/interviews/stats", { cacheMs: 30_000, token }),
          fetchMyProfile().catch(() => {
            setProfileLoadFailed(true);
            return null;
          })
        ]);
        const dashboardMessages = messages[getStoredLocale()].dashboardPage;
        setStats(nextStats);
        setProfile(profileResult?.profile ?? null);
        setShowOnboarding(!nextStats.preferences?.onboardingCompleted);
        notifyNewBadges(nextStats, dashboardMessages);
        maybeSendDailyReminder(nextStats, dashboardMessages);
      } catch {
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    }

    void loadStats();
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
  const c = dashboardCopy[locale];
  const weeklyTarget = stats?.weeklyGoal?.target ?? 3;
  const weeklyCompleted = stats?.weeklyGoal?.completed ?? 0;
  const weeklyPercent = weeklyTarget > 0 ? Math.min(100, (weeklyCompleted / weeklyTarget) * 100) : 0;
  const weeklyRemaining = Math.max(0, weeklyTarget - weeklyCompleted);
  const skillAverages = stats?.skillAverages ?? { content: 0, expertise: 0, language: 0, logic: 0, overall: 0 };
  const activeSession = useMemo(() => findResumableSession(stats?.recentSessions), [stats?.recentSessions]);
  const weakAreas = useMemo(() => getPriorityWeakAreas(stats?.weakAreas), [stats?.weakAreas]);
  const readiness = getReadinessScore({ averageScore: stats?.avgScore ?? null, skillOverall: skillAverages.overall });
  const scoreTrend = useMemo(() => getScoreTrend(stats?.recentSessions), [stats?.recentSessions]);
  const profileCompleteness = useMemo(() => getProfileCompleteness(profile), [profile]);
  const sevenDayPlan = useMemo(
    () => buildSevenDayPlan(stats?.weakAreas, c.fullMockInterview, c.practiceTasks),
    [c.fullMockInterview, c.practiceTasks, stats?.weakAreas]
  );
  const firstName = userName.trim().split(/\s+/).at(-1) ?? "";
  const primaryAction = activeSession
    ? {
        description: c.resumeDescription,
        href: `/interview?sessionId=${activeSession.id}`,
        label: c.resume,
        title: activeSession.targetMajor ?? c.unfinishedInterview
      }
    : {
        description: weakAreas[0]
          ? interpolate(c.weakFocusDescription, { area: weakAreas[0].category })
          : c.startDescription,
        href: "/interview/setup",
        label: t.quickStart,
        title: weakAreas[0]?.category ?? c.firstPractice
      };

  async function updatePreferences(input: Partial<NonNullable<Stats["preferences"]>>) {
    const token = getAuthToken();
    if (!token) return;
    const summary = await apiPut<{
      badges: Stats["badges"];
      preferences: NonNullable<Stats["preferences"]>;
      weeklyGoal: NonNullable<Stats["weeklyGoal"]>;
    }>("/api/gamification/preferences", input, { token });
    setStats((current) => current
      ? { ...current, badges: summary.badges, preferences: summary.preferences, weeklyGoal: summary.weeklyGoal }
      : current);
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

  if (isLoading) {
    return (
      <main className="page-band min-h-screen p-4 sm:p-6">
        <InlineSystemLoading title={c.loadingTitle} description={c.loadingDescription} />
      </main>
    );
  }

  return (
    <main className="page-band min-h-screen text-foreground" aria-label={t.dashboard}>
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="type-caption text-primary">{c.today}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl dark:text-white">
              {firstName ? interpolate(c.greeting, { name: firstName }) : c.greetingFallback}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{c.pageDescription}</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" aria-live="polite">
            <Activity size={15} aria-hidden="true" />
            <span className="max-w-64 truncate">{streamText || c.aiReady}</span>
          </div>
        </header>

        {loadFailed ? (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100" role="status">
            <AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
            <div>
              <p className="text-sm font-black">{c.loadFailedTitle}</p>
              <p className="mt-1 text-xs font-semibold opacity-80">{c.loadFailedDescription}</p>
            </div>
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-5 text-white shadow-xl shadow-blue-900/10 sm:p-7" aria-labelledby="today-priority">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border-[48px] border-white/5" />
          <div className="pointer-events-none absolute bottom-0 right-1/3 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-black text-blue-50">
                <Sparkles size={15} aria-hidden="true" />
                {c.todayPriority}
              </div>
              <h2 id="today-priority" className="mt-4 max-w-2xl text-2xl font-black leading-tight sm:text-4xl">
                {primaryAction.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-blue-100 sm:text-base">
                {primaryAction.description}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href={primaryAction.href} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-blue-700 shadow-lg transition hover:bg-blue-50">
                  <Play size={18} fill="currentColor" aria-hidden="true" />
                  {primaryAction.label}
                </Link>
                <Link href="/interview/history" className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-black text-white transition hover:bg-white/20">
                  <History size={18} aria-hidden="true" />
                  {c.reviewHistory}
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-slate-950/20 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100">{c.thisWeek}</p>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-black">
                  {weeklyCompleted}/{weeklyTarget}
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">
                {weeklyRemaining > 0
                  ? interpolate(c.sessionsRemaining, { count: weeklyRemaining })
                  : c.weeklyGoalComplete}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20" aria-label={d.weeklyGoal} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(weeklyPercent)}>
                <div className="h-full rounded-full bg-amber-300 transition-all duration-500" style={{ width: `${weeklyPercent}%` }} />
              </div>
              <div className="mt-5 flex items-center justify-between text-xs font-bold text-blue-100">
                <span>{interpolate(c.currentStreak, { count: stats?.streak ?? 0 })}</span>
                <span>{interpolate(c.completedCount, { count: stats?.completedSessions ?? 0 })}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={c.overview}>
          <Metric
            icon={<Gauge size={20} />}
            label={c.readiness}
            value={readiness != null ? <><CountUp value={readiness} />%</> : d.emptyScore}
            hint={readiness != null ? c.readinessHint : c.notEnoughScore}
            tone="primary"
          />
          <Metric
            icon={<BarChart3 size={20} />}
            label={d.averageScore}
            value={stats?.avgScore != null ? <><CountUp value={stats.avgScore} decimals={1} />/10</> : d.emptyScore}
            hint={<TrendHint trend={scoreTrend} copy={c} />}
            tone="warning"
          />
          <Metric
            icon={<Flame size={20} />}
            label={d.streak}
            value={<><CountUp value={stats?.streak ?? 0} /> {d.dayUnit}</>}
            hint={c.streakHint}
            tone="danger"
          />
          <Metric
            icon={<UserCheck size={20} />}
            label={c.profileStatus}
            value={profileLoadFailed ? c.unknown : `${profileCompleteness.percent}%`}
            hint={
              <Link href="/profile" className="focus-ring inline-flex items-center gap-1 text-primary hover:underline">
                {profileLoadFailed
                  ? c.updateProfile
                  : interpolate(c.profileCompletedFields, {
                      completed: profileCompleteness.completed,
                      total: profileCompleteness.total
                    })}
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            }
            tone="success"
          />
        </section>

        {showOnboarding ? (
          <section className="mt-5 animate-[fade-in_180ms_ease-out]" aria-labelledby="onboarding-title">
            <Card className="border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className="type-caption text-primary">{d.onboardingEyebrow}</p>
                  <h2 id="onboarding-title" className="type-title mt-2">{c.setupTitle}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{c.setupDescription}</p>
                </div>
                <button type="button" onClick={finishOnboarding} className="focus-ring min-h-11 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-black text-primary dark:border-blue-800 dark:bg-slate-950">
                  {d.gotIt}
                </button>
              </div>
              <ol className="mt-5 grid gap-3 md:grid-cols-4">
                {d.onboardingSteps.map((item, index) => (
                  <li key={item} className="flex items-center gap-3 rounded-xl bg-white p-4 text-sm font-bold text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-200">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </Card>
          </section>
        ) : null}

        <section className="mt-5" aria-labelledby="quick-actions-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="type-caption text-primary">{c.startHere}</p>
              <h2 id="quick-actions-title" className="type-section mt-1">{c.quickActions}</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <QuickAction href="/interview/setup" icon={<Play size={20} />} title={c.newInterview} description={c.newInterviewDescription} tone="blue" />
            <QuickAction href={activeSession ? `/interview?sessionId=${activeSession.id}` : "/interview/history"} icon={<RotateCcw size={20} />} title={activeSession ? c.resume : c.reviewAnswers} description={activeSession ? c.resumeShortDescription : c.reviewAnswersDescription} tone="violet" />
            <QuickAction href="/profile" icon={<FileText size={20} />} title={c.completeProfile} description={c.completeProfileDescription} tone="amber" />
            <QuickAction href="/interview/history" icon={<BarChart3 size={20} />} title={c.viewProgress} description={c.viewProgressDescription} tone="emerald" />
          </div>
        </section>

        <section
          id="practice-plan"
          className="mt-5 grid scroll-mt-24 gap-5 xl:grid-cols-[0.72fr_1.28fr]"
          aria-labelledby="practice-plan-title"
        >
          <div className="space-y-5">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <PanelTitle icon={<Target size={18} />} title={d.weeklyGoal} />
                <Badge tone={weeklyPercent >= 100 ? "success" : "primary"}>{Math.round(weeklyPercent)}%</Badge>
              </div>
              <p className="mt-5 text-3xl font-black text-primary">{weeklyCompleted}/{weeklyTarget}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{c.completedThisWeek}</p>
              <Progress value={weeklyPercent} className="mt-4" />
              <fieldset className="mt-5">
                <legend className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{c.adjustGoal}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 7].map((target) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => changeWeeklyGoal(target)}
                      aria-pressed={stats?.weeklyGoal?.target === target}
                      className={`focus-ring min-h-11 rounded-lg border px-3 text-xs font-black transition ${
                        stats?.weeklyGoal?.target === target
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                          : "border-border hover:bg-slate-50 dark:hover:bg-slate-900"
                      }`}
                    >
                      {interpolate(d.perWeek, { target })}
                    </button>
                  ))}
                </div>
              </fieldset>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <PanelTitle icon={<Lightbulb size={18} />} title={c.practiceFocus} />
                <Badge tone="warning">{weakAreas.length}/3</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {weakAreas.map((area, index) => (
                  <div key={area.category} className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-xs font-black text-slate-950">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-black text-amber-950 dark:text-amber-100">{area.category}</p>
                          <span className="text-sm font-black text-amber-700 dark:text-amber-200">{area.score.toFixed(1)}/10</span>
                        </div>
                        <Progress value={area.score * 10} className="mt-2 bg-amber-100 dark:bg-amber-900" />
                      </div>
                    </div>
                  </div>
                ))}
                {!weakAreas.length ? (
                  <EmptyState icon={<BookOpenCheck size={22} />} title={c.noWeakData} description={c.noWeakDataDescription} />
                ) : null}
              </div>
              <Link href="/interview/setup" className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-black text-primary hover:bg-blue-50 dark:hover:bg-blue-950">
                {d.practiceNow}<ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <PanelTitle icon={<Calendar size={18} />} title={c.practiceReminder} />
                <Badge tone={stats?.preferences?.browserNotificationsEnabled ? "success" : "neutral"}>
                  {stats?.preferences?.browserNotificationsEnabled ? c.on : c.off}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{c.reminderHelp}</p>
              <button type="button" onClick={enableNotifications} className="focus-ring mt-4 min-h-11 w-full rounded-xl border border-border px-3 text-sm font-black hover:bg-slate-50 dark:hover:bg-slate-900">
                {stats?.preferences?.browserNotificationsEnabled ? d.reminderOn : d.enableReminder}
              </button>
            </Card>
          </div>

          <Card className="h-fit" >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="type-caption text-violet-600">{c.personalizedPlan}</p>
                <h2 id="practice-plan-title" className="type-section mt-1">{c.sevenDayPlan}</h2>
                <p className="mt-1 max-w-xl text-sm font-semibold text-slate-500 dark:text-slate-400">{c.planDescription}</p>
              </div>
              <Link href="/interview/setup" className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white hover:bg-blue-700">
                <Play size={16} aria-hidden="true" />{c.startDayOne}
              </Link>
            </div>
            <ol className="mt-5 space-y-3">
              {sevenDayPlan.map((item, index) => (
                <li key={item.day} className={`group grid gap-3 rounded-xl border p-4 transition sm:grid-cols-[auto_1fr_auto] sm:items-center ${
                  index === 0
                    ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/60"
                    : "border-slate-200 hover:border-blue-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-blue-900 dark:hover:bg-slate-900"
                }`}>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black ${
                    index === 0 ? "bg-primary text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    {item.day}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-950 dark:text-white">{interpolate(c.dayLabel, { day: item.day })}</p>
                      {index === 0 ? <Badge tone="primary">{c.todayBadge}</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-primary">{item.focus}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{item.task}</p>
                  </div>
                  <ChevronRight className="hidden text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary sm:block" size={18} aria-hidden="true" />
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              {c.planDisclosure}
            </p>
          </Card>
        </section>

        <section
          id="progress"
          className="mt-5 grid scroll-mt-24 gap-5 xl:grid-cols-[1.15fr_0.85fr]"
          aria-labelledby="progress-title"
        >
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="type-caption text-primary">{d.progressEyebrow}</p>
                <h2 id="progress-title" className="type-section mt-1">{d.progressTitle}</h2>
              </div>
              <Badge tone="primary">{stats?.completedSessions ?? 0} {d.completed}</Badge>
            </div>
            {stats?.progress?.length ? (
              <ProgressLineChart data={stats.progress} />
            ) : (
              <EmptyState icon={<BarChart3 size={23} />} title={c.noProgress} description={c.noProgressDescription} />
            )}
          </Card>

          <Card>
            <div className="mb-4">
              <p className="type-caption text-emerald-600">{d.skillEyebrow}</p>
              <h2 className="type-section mt-1">{d.skillTitle}</h2>
            </div>
            {stats?.completedSessions ? (
              <SkillRadarMini data={skillAverages} />
            ) : (
              <EmptyState icon={<Gauge size={23} />} title={c.noSkillData} description={c.noSkillDataDescription} />
            )}
          </Card>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]" aria-label={c.activityAndAwards}>
          <Card>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="type-caption text-primary">{c.recentActivity}</p>
                <h2 className="type-section mt-1">{d.recentSessions}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{d.recentSessionsHelp}</p>
              </div>
              <Link href="/interview/history" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-black hover:bg-slate-50 dark:hover:bg-slate-900">
                {c.viewAll}<ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
              {(stats?.recentSessions?.length ? stats.recentSessions.slice(0, 5) : []).map((session) => (
                <article key={session.id} className="grid gap-3 py-4 first:pt-1 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      session.status === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950"
                        : "bg-amber-50 text-amber-600 dark:bg-amber-950"
                    }`}>
                      {session.status === "COMPLETED" ? <Check size={19} aria-hidden="true" /> : <Clock3 size={19} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                          {session.targetMajor ?? session.targetSchool ?? c.interviewSession}
                        </p>
                        <Badge tone={session.status === "COMPLETED" ? "success" : "warning"}>
                          {statusLabel[locale][session.status] ?? session.status}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {session.targetSchool ?? c.schoolNotSet} · {formatDashboardDate(session.createdAt, locale)} · {session.answeredQuestions}/{session.totalQuestions} {d.questions}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                      {session.totalScore != null ? `${session.totalScore.toFixed(1)}/10` : d.emptyScore}
                    </span>
                    <Link
                      href={session.status === "COMPLETED" ? `/interview/result?sessionId=${session.id}` : `/interview?sessionId=${session.id}`}
                      className="focus-ring inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 text-xs font-black text-primary hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-950"
                      aria-label={`${session.status === "COMPLETED" ? d.viewReport : d.continue}: ${session.targetMajor ?? c.interviewSession}`}
                    >
                      {session.status === "COMPLETED" ? d.viewReport : d.continue}
                      <ChevronRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
              {!stats?.recentSessions?.length ? (
                <EmptyState icon={<History size={23} />} title={d.noRecentSessions} description={c.noRecentDescription} />
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="type-caption text-amber-600">{c.milestones}</p>
                <h2 className="type-section mt-1">{d.badges}</h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950">
                <Award size={20} aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {(stats?.badges?.length ? stats.badges.slice(0, 4) : []).map((badge) => (
                <div key={badge.label} className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-black ${
                  badge.earned
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                    : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900"
                }`}>
                  <span className="text-xl" aria-hidden="true">{badge.icon || "🏅"}</span>
                  <span>{badge.label}</span>
                  {badge.earned ? <Check className="ml-auto" size={16} aria-label={c.earned} /> : null}
                </div>
              ))}
              {!stats?.badges?.length ? (
                <EmptyState icon={<Award size={22} />} title={d.noBadge} description={c.noBadgeDescription} />
              ) : null}
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">{d.xp}</span>
                <span className="text-lg font-black text-emerald-600">{stats?.xp ?? 0} XP</span>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{stats?.level ?? "Beginner"}</p>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Metric({
  hint,
  icon,
  label,
  tone,
  value
}: {
  hint: React.ReactNode;
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
      <div className="flex items-center justify-between gap-3">
        <p className="type-caption text-slate-500">{label}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`} aria-hidden="true">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
      <div className="mt-1 min-h-5 text-xs font-bold text-slate-500 dark:text-slate-400">{hint}</div>
    </Card>
  );
}

function TrendHint({ copy, trend }: { copy: DashboardEnhancementCopy; trend: number | null }) {
  if (trend == null) return <span>{copy.needTwoSessions}</span>;
  if (trend === 0) return <span>{copy.noScoreChange}</span>;
  return (
    <span className={`inline-flex items-center gap-1 ${trend > 0 ? "text-emerald-600" : "text-red-600"}`}>
      <TrendingUp className={trend > 0 ? "" : "rotate-180"} size={14} aria-hidden="true" />
      {interpolate(trend > 0 ? copy.scoreIncreased : copy.scoreDecreased, { score: Math.abs(trend) })}
    </span>
  );
}

function QuickAction({
  description,
  href,
  icon,
  title,
  tone
}: {
  description: string;
  href: string;
  icon: React.ReactNode;
  title: string;
  tone: "amber" | "blue" | "emerald" | "violet";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950"
  };

  return (
    <Link href={href} className="focus-ring group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`} aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-sm font-black text-slate-950 dark:text-white">
            {title}<ChevronRight className="transition group-hover:translate-x-0.5" size={15} aria-hidden="true" />
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ description, icon, title }: { description: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900" aria-hidden="true">{icon}</span>
      <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 max-w-xs text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary" aria-hidden="true">{icon}</span>
      <h2 className="type-section">{title}</h2>
    </div>
  );
}

function formatDashboardDate(value: string, locale: Locale) {
  const dateLocale = locale === "zh" ? "zh-CN" : locale === "en" ? "en-US" : "vi-VN";
  return new Intl.DateTimeFormat(dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

const viDashboardCopy = {
    activityAndAwards: "Hoạt động và thành tựu",
    adjustGoal: "Điều chỉnh mục tiêu",
    aiReady: "AI sẵn sàng hỗ trợ",
    completeProfile: "Hoàn thiện hồ sơ",
    completeProfileDescription: "Cập nhật thông tin để AI chọn câu hỏi sát hơn.",
    completedCount: "{count} buổi đã hoàn thành",
    completedThisWeek: "Buổi phỏng vấn đã hoàn thành trong tuần này",
    currentStreak: "Chuỗi hiện tại: {count} ngày",
    dayLabel: "Ngày {day}",
    earned: "Đã đạt",
    firstPractice: "Bắt đầu buổi luyện đầu tiên",
    fullMockInterview: "Phỏng vấn tổng hợp",
    greeting: "Chào {name}, hôm nay mình luyện gì?",
    greetingFallback: "Hôm nay mình luyện gì?",
    incomplete: "Cần bổ sung",
    interviewSession: "Buổi phỏng vấn",
    loadFailedDescription: "Các mục chưa có dữ liệu sẽ hiển thị trạng thái trống. Bạn vẫn có thể bắt đầu phỏng vấn.",
    loadFailedTitle: "Chưa tải được toàn bộ dữ liệu tiến bộ",
    loadingDescription: "AI đang tổng hợp tiến bộ và ưu tiên luyện tập hôm nay.",
    loadingTitle: "Đang chuẩn bị bảng điều khiển",
    milestones: "Cột mốc",
    needTwoSessions: "Cần 2 buổi để so sánh",
    newInterview: "Phỏng vấn mới",
    newInterviewDescription: "Thiết lập mục tiêu và bắt đầu một buổi mới.",
    noBadgeDescription: "Hoàn thành các buổi luyện tập để mở khóa cột mốc đầu tiên.",
    noProgress: "Chưa có biểu đồ tiến bộ",
    noProgressDescription: "Điểm số sẽ xuất hiện sau khi bạn hoàn thành buổi phỏng vấn đầu tiên.",
    noRecentDescription: "Bắt đầu một buổi phỏng vấn để xây dựng lịch sử luyện tập.",
    noScoreChange: "Không đổi so với buổi trước",
    noSkillData: "Chưa đủ dữ liệu kỹ năng",
    noSkillDataDescription: "Radar kỹ năng được tạo từ các câu trả lời đã chấm điểm.",
    noWeakData: "Chưa xác định được điểm yếu",
    noWeakDataDescription: "Hoàn thành một buổi để AI tìm ra trọng tâm cần luyện.",
    notEnoughScore: "Chưa đủ dữ liệu chấm điểm",
    off: "Đang tắt",
    on: "Đang bật",
    overview: "Tổng quan tiến độ",
    pageDescription: "Một nơi để tiếp tục luyện tập, xem tiến bộ và biết rõ bước tiếp theo.",
    personalizedPlan: "Gợi ý cá nhân hóa",
    planDescription: "Lộ trình được sắp theo các nhóm kỹ năng có điểm thấp nhất của bạn.",
    planDisclosure: "Đây là kế hoạch gợi ý từ dữ liệu hiện có. Kết quả từng ngày chỉ được ghi nhận sau khi bạn thực sự hoàn thành buổi luyện.",
    practiceFocus: "3 trọng tâm cần luyện",
    practiceReminder: "Nhắc lịch luyện tập",
    practiceTasks: [
      "Trả lời 3 câu ngắn và xem lại phản hồi",
      "Luyện cấu trúc mở bài, luận điểm và kết luận",
      "Bổ sung ví dụ cụ thể cho từng luận điểm",
      "Luyện trả lời câu hỏi đào sâu theo cùng chủ đề",
      "Tự ghi âm, nghe lại và sửa một lần",
      "Thực hiện một lượt luyện tập có giới hạn thời gian",
      "Phỏng vấn thử trọn buổi và so sánh kết quả"
    ],
    profileCompletedFields: "{completed}/{total} mục bắt buộc đã hoàn thành",
    profileStatus: "Thiết lập hồ sơ",
    quickActions: "Thao tác nhanh",
    readiness: "Mức sẵn sàng",
    readinessHint: "Ước tính từ điểm kỹ năng thực tế",
    ready: "Đã xem hướng dẫn",
    recentActivity: "Hoạt động gần đây",
    reminderHelp: "Nhận lời nhắc khi hôm nay bạn chưa hoàn thành mục tiêu luyện tập.",
    resume: "Tiếp tục buổi đang dở",
    resumeDescription: "Bạn còn một buổi chưa hoàn thành. Tiếp tục từ câu hỏi gần nhất để không mất tiến độ.",
    resumeShortDescription: "Quay lại đúng phiên và câu hỏi gần nhất.",
    reviewAnswers: "Xem lại câu trả lời",
    reviewAnswersDescription: "Mở báo cáo và chọn nội dung cần luyện lại.",
    reviewHistory: "Xem lịch sử",
    schoolNotSet: "Chưa đặt trường mục tiêu",
    scoreDecreased: "Giảm {score} điểm so với buổi trước",
    scoreIncreased: "Tăng {score} điểm so với buổi trước",
    sessionsRemaining: "Còn {count} buổi để đạt mục tiêu",
    setupDescription: "Đi qua bốn bước ngắn để nhận câu hỏi và phản hồi sát mục tiêu hơn.",
    setupTitle: "Thiết lập trải nghiệm luyện tập",
    sevenDayPlan: "Kế hoạch luyện tập 7 ngày",
    startDayOne: "Bắt đầu ngày 1",
    startDescription: "Hoàn thành một buổi để AI xây dựng phân tích và kế hoạch luyện tập cá nhân.",
    startHere: "Bắt đầu từ đây",
    streakHint: "Duy trì bằng một buổi hoàn thành hôm nay",
    thisWeek: "Mục tiêu tuần này",
    today: "Tổng quan hôm nay",
    todayBadge: "Hôm nay",
    todayPriority: "Ưu tiên hôm nay",
    unfinishedInterview: "Bạn có một buổi phỏng vấn đang dở",
    unknown: "Chưa xác định",
    updateProfile: "Cập nhật hồ sơ",
    viewAll: "Xem tất cả",
    viewProgress: "Xem tiến bộ",
    viewProgressDescription: "Đọc báo cáo và so sánh các buổi gần đây.",
    weakFocusDescription: "Điểm cần ưu tiên hiện tại là {area}. Bắt đầu một lượt luyện để cải thiện có trọng tâm.",
    weeklyGoalComplete: "Bạn đã hoàn thành mục tiêu tuần"
};

type DashboardEnhancementCopy = typeof viDashboardCopy;

const dashboardCopy: Record<Locale, DashboardEnhancementCopy> = {
  vi: viDashboardCopy,
  en: {
    activityAndAwards: "Activity and achievements",
    adjustGoal: "Adjust goal",
    aiReady: "AI is ready to help",
    completeProfile: "Complete profile",
    completeProfileDescription: "Update your information so AI can select more relevant questions.",
    completedCount: "{count} sessions completed",
    completedThisWeek: "Interview sessions completed this week",
    currentStreak: "Current streak: {count} days",
    dayLabel: "Day {day}",
    earned: "Earned",
    firstPractice: "Start your first practice session",
    fullMockInterview: "Full mock interview",
    today: "Today overview",
    greeting: "Hi {name}, what shall we practise today?",
    greetingFallback: "What shall we practise today?",
    incomplete: "Needs more information",
    interviewSession: "Interview session",
    loadFailedDescription: "Sections without data will show an empty state. You can still start an interview.",
    loadFailedTitle: "Some progress data could not be loaded",
    loadingDescription: "AI is summarizing your progress and today's practice priorities.",
    loadingTitle: "Preparing your dashboard",
    milestones: "Milestones",
    needTwoSessions: "Complete 2 sessions to compare",
    newInterview: "New interview",
    newInterviewDescription: "Set your target and begin a new session.",
    noBadgeDescription: "Complete practice sessions to unlock your first milestone.",
    noProgress: "No progress chart yet",
    noProgressDescription: "Your scores will appear after you complete your first interview.",
    noRecentDescription: "Start an interview to build your practice history.",
    noScoreChange: "No change from the previous session",
    noSkillData: "Not enough skill data",
    noSkillDataDescription: "The skill radar is built from answers that have been scored.",
    noWeakData: "No weak area identified yet",
    noWeakDataDescription: "Complete a session so AI can identify what to focus on.",
    notEnoughScore: "Not enough scoring data",
    off: "Off",
    on: "On",
    overview: "Progress overview",
    pageDescription: "Continue practising, review progress and know exactly what to do next.",
    personalizedPlan: "Personalized suggestion",
    planDescription: "This roadmap prioritizes the skill groups with your lowest scores.",
    planDisclosure: "This plan is suggested from your available data. A day is only recorded after you actually complete its practice session.",
    practiceFocus: "Top 3 practice priorities",
    practiceReminder: "Practice reminder",
    practiceTasks: [
      "Answer 3 short questions and review the feedback",
      "Practise an opening, key points and a conclusion",
      "Add a specific example to each key point",
      "Practise follow-up questions on the same topic",
      "Record yourself, listen back and revise once",
      "Complete a timed practice round",
      "Run a full mock interview and compare the result"
    ],
    profileCompletedFields: "{completed}/{total} required fields completed",
    profileStatus: "Profile setup",
    quickActions: "Quick actions",
    readiness: "Readiness",
    readinessHint: "Estimated from your actual skill scores",
    ready: "Guide reviewed",
    recentActivity: "Recent activity",
    reminderHelp: "Get a reminder when you have not completed today's practice goal.",
    resume: "Resume unfinished session",
    resumeDescription: "You have an unfinished session. Continue from the latest question without losing progress.",
    resumeShortDescription: "Return to the exact session and latest question.",
    reviewAnswers: "Review answers",
    reviewAnswersDescription: "Open a report and choose what to practise again.",
    todayPriority: "Today's priority",
    reviewHistory: "View history",
    schoolNotSet: "Target school not set",
    scoreDecreased: "Down {score} points from the previous session",
    scoreIncreased: "Up {score} points from the previous session",
    sessionsRemaining: "{count} sessions left to reach your goal",
    setupDescription: "Follow four short steps to receive questions and feedback that better match your goal.",
    setupTitle: "Set up your practice experience",
    sevenDayPlan: "7-day practice plan",
    startDayOne: "Start day 1",
    startDescription: "Complete a session so AI can build your personalized analysis and practice plan.",
    startHere: "Start here",
    streakHint: "Keep it going by completing a session today",
    thisWeek: "This week's goal",
    todayBadge: "Today",
    unfinishedInterview: "You have an unfinished interview",
    unknown: "Unavailable",
    updateProfile: "Update profile",
    viewAll: "View all",
    viewProgress: "View progress",
    viewProgressDescription: "Read reports and compare your recent sessions.",
    weakFocusDescription: "Your current priority is {area}. Start a focused practice round to improve it.",
    weeklyGoalComplete: "You completed this week's goal"
  },
  zh: {
    activityAndAwards: "活动与成就",
    adjustGoal: "调整目标",
    aiReady: "AI 已准备好提供帮助",
    completeProfile: "完善档案",
    completeProfileDescription: "更新信息，让 AI 选择更符合目标的问题。",
    completedCount: "已完成 {count} 场",
    completedThisWeek: "本周已完成的面试场次",
    currentStreak: "当前连续练习：{count} 天",
    dayLabel: "第 {day} 天",
    earned: "已获得",
    firstPractice: "开始第一次练习",
    fullMockInterview: "综合模拟面试",
    today: "今日概览",
    greeting: "{name}，今天练什么？",
    greetingFallback: "今天练什么？",
    incomplete: "需要补充",
    interviewSession: "面试场次",
    loadFailedDescription: "暂无数据的部分将显示为空状态。你仍然可以开始面试。",
    loadFailedTitle: "部分进度数据暂时无法加载",
    loadingDescription: "AI 正在汇总你的进度和今日练习重点。",
    loadingTitle: "正在准备控制台",
    milestones: "里程碑",
    needTwoSessions: "完成 2 场后即可比较",
    newInterview: "新面试",
    newInterviewDescription: "设置目标并开始一场新面试。",
    noBadgeDescription: "完成练习，解锁你的第一个里程碑。",
    noProgress: "暂无进步图表",
    noProgressDescription: "完成第一次面试后，这里将显示你的分数。",
    noRecentDescription: "开始一场面试，建立你的练习记录。",
    noScoreChange: "与上一场相比没有变化",
    noSkillData: "技能数据不足",
    noSkillDataDescription: "技能雷达根据已评分的回答生成。",
    noWeakData: "尚未识别出薄弱项",
    noWeakDataDescription: "完成一场面试，让 AI 找出需要重点练习的内容。",
    notEnoughScore: "评分数据不足",
    off: "已关闭",
    on: "已开启",
    overview: "进度概览",
    pageDescription: "继续练习、查看进步，并明确下一步。",
    personalizedPlan: "个性化建议",
    planDescription: "此路线会优先安排你得分最低的技能类别。",
    planDisclosure: "此计划根据现有数据生成。只有真正完成当天练习后，系统才会记录结果。",
    practiceFocus: "3 个重点练习方向",
    practiceReminder: "练习提醒",
    practiceTasks: [
      "回答 3 个简短问题并查看反馈",
      "练习开场、核心观点和总结结构",
      "为每个核心观点补充具体例子",
      "围绕同一主题练习追问",
      "录下回答，回听并修改一次",
      "完成一轮限时练习",
      "完成整场模拟面试并比较结果"
    ],
    profileCompletedFields: "已完成 {completed}/{total} 个必填项",
    profileStatus: "档案设置",
    quickActions: "快捷操作",
    readiness: "准备度",
    readinessHint: "根据实际技能分数估算",
    ready: "已查看指南",
    recentActivity: "最近活动",
    reminderHelp: "如果今天尚未完成练习目标，可接收提醒。",
    resume: "继续未完成的面试",
    resumeDescription: "你有一场尚未完成的面试。可从最近的问题继续，不会丢失进度。",
    resumeShortDescription: "返回原面试并继续最近的问题。",
    reviewAnswers: "回顾回答",
    reviewAnswersDescription: "打开报告并选择需要再次练习的内容。",
    todayPriority: "今日优先",
    reviewHistory: "查看历史",
    schoolNotSet: "尚未设置目标院校",
    scoreDecreased: "比上一场下降 {score} 分",
    scoreIncreased: "比上一场提高 {score} 分",
    sessionsRemaining: "还需 {count} 场即可达成目标",
    setupDescription: "完成四个简短步骤，获取更符合目标的问题和反馈。",
    setupTitle: "设置练习体验",
    sevenDayPlan: "7 天练习计划",
    startDayOne: "开始第 1 天",
    startDescription: "完成一场面试，让 AI 为你生成个性化分析和练习计划。",
    startHere: "从这里开始",
    streakHint: "今天完成一场练习以保持连续记录",
    thisWeek: "本周目标",
    todayBadge: "今天",
    unfinishedInterview: "你有一场未完成的面试",
    unknown: "暂无法确定",
    updateProfile: "更新档案",
    viewAll: "查看全部",
    viewProgress: "查看进步",
    viewProgressDescription: "阅读报告并比较最近几场面试。",
    weakFocusDescription: "当前最需要优先提升的是{area}。开始一轮针对性练习吧。",
    weeklyGoalComplete: "你已完成本周目标"
  }
};

const statusLabel: Record<Locale, Record<string, string>> = {
  vi: { CANCELLED: "Đã hủy", COMPLETED: "Hoàn thành", DRAFT: "Bản nháp", IN_PROGRESS: "Đang thực hiện", PAUSED: "Tạm dừng" },
  en: { CANCELLED: "Cancelled", COMPLETED: "Completed", DRAFT: "Draft", IN_PROGRESS: "In progress", PAUSED: "Paused" },
  zh: { CANCELLED: "已取消", COMPLETED: "已完成", DRAFT: "草稿", IN_PROGRESS: "进行中", PAUSED: "已暂停" }
};

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
