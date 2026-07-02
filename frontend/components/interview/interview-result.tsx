"use client";

import { Copy, FileDown, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfettiBurst } from "@/components/ui/confetti-burst";
import {
  activeInterviewSessionStorageKey,
  fetchInterviewAnalysis,
  fetchInterviewSession,
  type InterviewAnalysisDto,
  type InterviewReportDto,
  type InterviewSessionDto
} from "@/lib/interview-client";

const AnswerFeedbackPanel = dynamic(
  () => import("./answer-feedback-panel").then((mod) => mod.AnswerFeedbackPanel),
  {
    loading: () => <div className="skeleton h-40 rounded-lg" />,
    ssr: false
  }
);

const ScoreRadarChart = dynamic(
  () => import("./score-radar-chart").then((mod) => mod.ScoreRadarChart),
  {
    loading: () => <div className="skeleton h-[300px] rounded-lg" />,
    ssr: false
  }
);

type ResultTab = "details" | "overview" | "tips";

export function InterviewResult() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [analysis, setAnalysis] = useState<InterviewAnalysisDto | null>(null);
  const [persistedReport, setPersistedReport] = useState<InterviewReportDto | null>(null);
  const [session, setSession] = useState<InterviewSessionDto | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("overview");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadResult() {
      const sessionId = searchParams.get("sessionId") || sessionStorage.getItem(activeInterviewSessionStorageKey);

      if (!sessionId) {
        router.replace("/interview/setup");
        return;
      }

      try {
        const [data, analysisData] = await Promise.all([
          fetchInterviewSession(sessionId),
          fetchInterviewAnalysis(sessionId).catch(() => null)
        ]);

        if (!ignore) {
          setSession(data.session);
          setAnalysis(analysisData?.analysis ?? null);
          setPersistedReport(analysisData?.report ?? null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Không thể tải kết quả phỏng vấn";
        setError(message);

        if (message.includes("dang nhap")) {
          router.replace("/login");
        }
      }
    }

    loadResult();

    return () => {
      ignore = true;
    };
  }, [router, searchParams]);

  const report = useMemo(() => buildReport(session), [session]);
  const finalReport = persistedReport
    ? mergePersistedReport(report, persistedReport, analysis)
    : analysis
      ? mergeAnalysis(report, analysis)
      : report;

  async function copyReportLink() {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function exportPdf() {
    window.print();
  }

  return (
    <main className="page-band min-h-screen p-3 text-foreground sm:p-5">
      <ConfettiBurst active={finalReport.overall >= 80} />
      <section className="mx-auto max-w-7xl rounded-lg border border-border bg-background p-5 shadow-[var(--shadow-ui)] sm:p-7">
        <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-center">
          <div>
            <p className="type-caption text-primary">Kết quả phỏng vấn</p>
            <h1 className="type-display mt-2">Báo cáo sau buổi luyện</h1>
            <p className="type-body mt-2 text-slate-600 dark:text-slate-300">
              Feedback chi tiết, điểm theo tiêu chí, gợi ý cải thiện và theo dõi tiến bộ.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={copyReportLink} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-black">
              <Copy size={16} /> {copied ? "Đã copy" : "Copy link"}
            </button>
            <button type="button" onClick={exportPdf} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-black">
              <FileDown size={16} /> Export PDF
            </button>
            <Link href="/interview/setup" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-black text-white">
              Luyện lại
            </Link>
          </div>
        </header>

        {error ? <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="rounded-lg border border-border bg-primary/5 p-6">
            <h2 className="type-section">Điểm tổng quan</h2>
            <div className="mt-7 flex flex-col items-center">
              <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-[12px] border-primary/10">
                <div className="absolute inset-[-12px] rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${finalReport.overall}%, transparent 0)` }} />
                <div className="absolute inset-0 rounded-full bg-background" />
                <div className="relative text-center">
                  <p className="text-5xl font-black">{finalReport.overall}</p>
                  <p className="text-sm font-black text-slate-500">/100</p>
                </div>
              </div>
              <p className="mt-5 text-lg font-black text-emerald-600">{finalReport.label}</p>
              <p className="mt-2 text-sm font-bold text-slate-500">{session?.answeredQuestions ?? 0}/{session?.totalQuestions ?? 0} câu đã trả lời</p>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background p-6">
            <h2 className="type-section">Chi tiết theo tiêu chí</h2>
            <div className="mt-6 space-y-5">
              {finalReport.criteria.map((item) => (
                <div key={item.label} className="grid grid-cols-[130px_1fr_42px] items-center gap-4">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.label}</p>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${item.value * 10}%` }} />
                  </div>
                  <p className="text-right text-sm font-black">{item.value.toFixed(1)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-5 border-b border-border">
          <div className="flex flex-wrap gap-2">
            {[
              ["overview", "Tổng quan"],
              ["details", "Chi tiết từng câu"],
              ["tips", "Gợi ý cải thiện"]
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id as ResultTab)}
                className={`focus-ring rounded-t-lg px-4 py-3 text-sm font-black transition ${activeTab === id ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-primary/5 p-6">
              <h2 className="type-section">AI nhận xét</h2>
              <p className="type-body mt-4 text-slate-700 dark:text-slate-200">{finalReport.summary}</p>
              {finalReport.progressHint ? <p className="mt-4 rounded-lg bg-background px-4 py-3 text-sm font-black text-primary">{finalReport.progressHint}</p> : null}
            </section>
            <section className="rounded-lg border border-border bg-background p-6">
              <h2 className="type-section mb-4">Radar năng lực</h2>
              {analysis?.criteriaAverages ? <ScoreRadarChart data={analysis.criteriaAverages} /> : <p className="type-body text-slate-500">Chưa đủ dữ liệu radar.</p>}
            </section>
          </div>
        ) : null}

        {activeTab === "tips" ? (
          <section className="mt-5 grid gap-5 lg:grid-cols-3">
            <ListCard title="Điểm mạnh nổi bật" items={analysis?.strengths ?? []} tone="good" />
            <ListCard title="Cần cải thiện" items={persistedReport?.repeatedMistakes ?? analysis?.weaknesses ?? []} tone="warn" />
            <ListCard title="Hành động tiếp theo" items={finalReport.suggestions} tone="info" />
          </section>
        ) : null}

        {activeTab === "details" ? (
          <section className="mt-5 rounded-lg border border-border bg-background p-6 shadow-sm">
            {analysis?.answerDetails?.length ? (
              <AnswerFeedbackPanel details={analysis.answerDetails} sessionId={session?.id ?? ""} />
            ) : (
              <div className="space-y-4">
                {(session?.questions ?? []).map((question, index) => {
                  const answer = session?.answers.find((item) => item.sessionQuestionId === question.id);
                  return (
                    <article key={question.id} className="rounded-lg border border-border bg-primary/5 p-4">
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div>
                          <p className="text-xs font-black uppercase text-primary">Câu {index + 1}</p>
                          <h3 className="mt-1 text-sm font-black">{question.questionText}</h3>
                        </div>
                        <Link href={`/interview/setup?practiceQuestionId=${question.id}`} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-black">
                          <RotateCcw size={14} /> Luyện lại câu này
                        </Link>
                      </div>
                      <p className="type-body mt-3 text-slate-600 dark:text-slate-300">{answer?.answerText || "Chưa có câu trả lời."}</p>
                      {answer?.feedback ? <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary">{answer.feedback}</p> : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

function ListCard({ items, title, tone }: { items: string[]; title: string; tone: "good" | "info" | "warn" }) {
  const colors = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    warn: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    info: "border-primary/20 bg-primary/10 text-primary"
  };

  return (
    <section className="rounded-lg border border-border bg-background p-6 shadow-sm">
      <h2 className="type-section">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.length ? items.map((item) => (
          <li key={item} className="type-body flex gap-3 text-slate-700 dark:text-slate-200">
            <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-black ${colors[tone]}`}>+</span>
            {item}
          </li>
        )) : <li className="type-body text-slate-500">Chưa đủ dữ liệu.</li>}
      </ul>
    </section>
  );
}

function mergeAnalysis(report: ReturnType<typeof buildReport>, analysis: InterviewAnalysisDto) {
  const overall = Math.round(analysis.overallScore * 10);

  return {
    ...report,
    criteria: [
      { label: "Nội dung", value: analysis.criteriaAverages.content || report.criteria[0].value },
      { label: "Logic", value: analysis.criteriaAverages.logic || report.criteria[1].value },
      { label: "Chuyên ngành", value: analysis.criteriaAverages.expertise || report.criteria[2].value },
      { label: "Ngôn ngữ", value: analysis.criteriaAverages.language || report.criteria[3].value },
      { label: "Tự tin", value: analysis.criteriaAverages.confidence || report.criteria[4].value },
      { label: "Ấn tượng", value: analysis.criteriaAverages.impression || report.criteria[4].value }
    ],
    label: overall >= 80 ? "Tốt" : overall >= 65 ? "Khá" : "Cần luyện thêm",
    overall,
    progressHint: analysis.progressHint || report.progressHint,
    suggestions: analysis.improvementTips.length ? analysis.improvementTips : report.suggestions,
    summary: [analysis.sessionSummary || report.summary, analysis.speechSummary].filter(Boolean).join(" ")
  };
}

function mergePersistedReport(
  report: ReturnType<typeof buildReport>,
  persistedReport: InterviewReportDto,
  analysis: InterviewAnalysisDto | null
) {
  const overall = Math.round(persistedReport.overallScore);
  const nextSteps = persistedReport.nextSteps.length ? persistedReport.nextSteps : report.suggestions;

  return {
    ...report,
    criteria: analysis?.criteriaAverages
      ? [
          { label: "Nội dung", value: analysis.criteriaAverages.content || report.criteria[0].value },
          { label: "Logic", value: analysis.criteriaAverages.logic || report.criteria[1].value },
          { label: "Chuyên ngành", value: analysis.criteriaAverages.expertise || report.criteria[2].value },
          { label: "Ngôn ngữ", value: analysis.criteriaAverages.language || report.criteria[3].value },
          { label: "Tự tin", value: analysis.criteriaAverages.confidence || report.criteria[4].value },
          { label: "Ấn tượng", value: analysis.criteriaAverages.impression || report.criteria[4].value }
        ]
      : report.criteria,
    label: overall >= 80 ? "Tốt" : overall >= 65 ? "Khá" : "Cần luyện thêm",
    overall,
    progressHint: persistedReport.logicFeedback ?? nextSteps[0] ?? report.progressHint,
    suggestions: persistedReport.recommendedPractice.length ? persistedReport.recommendedPractice : nextSteps,
    summary: persistedReport.summary ?? report.summary
  };
}

function buildReport(session: InterviewSessionDto | null) {
  const scores = (session?.answers ?? [])
    .map((answer) => Number(answer.scoreTotal ?? 0))
    .filter((score) => score > 0);
  const average = scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : 0;
  const overall = Math.round(average * 10);
  const normalized = average || 6.5;

  return {
    criteria: [
      { label: "Nội dung", value: normalized },
      { label: "Logic", value: Math.max(0, normalized - 0.5) },
      { label: "Chuyên ngành", value: Math.min(10, normalized + 0.5) },
      { label: "Ngôn ngữ", value: Math.max(0, normalized - 1) },
      { label: "Tự tin", value: normalized }
    ],
    label: overall >= 80 ? "Tốt" : overall >= 65 ? "Khá" : "Cần luyện thêm",
    overall,
    progressHint: "Ưu tiên luyện lại các câu điểm thấp và thêm ví dụ cá nhân cụ thể.",
    suggestions: [
      "Nêu rõ lý do chọn ngành và trường.",
      "Liên hệ ngành học với kinh nghiệm cá nhân.",
      "Kể thêm ví dụ thực tế để câu trả lời thuyết phục hơn.",
      "Trình bày kế hoạch cụ thể theo từng giai đoạn."
    ],
    summary: scores.length
      ? "Bạn trả lời khá tốt và diễn đạt rõ ràng. Một số ý còn chung, cần thêm ví dụ cụ thể để hội đồng thấy rõ sự phù hợp với ngành học."
      : "Bạn chưa có đủ câu trả lời để hệ thống đánh giá chính xác. Hãy luyện một lượt phỏng vấn rồi quay lai xem báo cáo chi tiết."
  };
}
