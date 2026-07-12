"use client";

import { Check, FileText, GraduationCap, Landmark, Loader2, Plane, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const progressSteps = [
  {
    icon: FileText,
    label: "Đọc hồ sơ Study Plan",
    description: "Chuẩn hóa nội dung và nhận diện các mục tiêu học tập"
  },
  {
    icon: Landmark,
    label: "Đối chiếu trường và ngành",
    description: "So sánh hồ sơ với định hướng đào tạo tại Trung Quốc"
  },
  {
    icon: GraduationCap,
    label: "Đánh giá khả năng học bổng",
    description: "Tìm điểm mạnh, điểm thiếu và mức độ phù hợp"
  },
  {
    icon: Sparkles,
    label: "Cá nhân hóa câu hỏi phỏng vấn",
    description: "Tạo bộ câu hỏi sát với Study Plan của bạn"
  }
] as const;

export function StudyPlanAnalysisProgress() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeStep = Math.min(progressSteps.length - 1, Math.floor(elapsedSeconds / 11));
  const progress = Math.min(92, Math.round(8 + elapsedSeconds * 1.65));
  const statusText = useMemo(() => {
    if (elapsedSeconds < 12) return "AI đang đọc và sắp xếp hồ sơ của bạn";
    if (elapsedSeconds < 26) return "Đang đối chiếu với tiêu chí trường và ngành";
    if (elapsedSeconds < 42) return "Giáo sư AI đang đánh giá chiều sâu Study Plan";
    return "Đang hoàn thiện nhận xét và câu hỏi cá nhân hóa";
  }, [elapsedSeconds]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#17120f]/80 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-plan-progress-title"
    >
      <section className="relative my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#fffaf7] shadow-[0_34px_100px_rgba(0,0,0,0.42)] dark:bg-slate-950">
        <div
          className="absolute inset-y-0 right-0 hidden w-[48%] bg-cover bg-center opacity-20 lg:block dark:opacity-15"
          style={{ backgroundImage: "url('/auth/image/study_abroad_hero.png')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(239,35,60,0.16),transparent_22rem)]" aria-hidden="true" />

        <div className="relative grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(184,29,36,0.24)]">
                <Plane size={23} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Hành trình du học</p>
                <p className="text-sm font-bold text-muted-foreground">Hồ sơ của bạn đang được chuẩn bị</p>
              </div>
            </div>

            <h2 id="study-plan-progress-title" className="mt-7 text-2xl font-black leading-tight text-foreground sm:text-3xl">
              Giáo sư AI đang phân tích Study Plan
            </h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-muted-foreground">
              Quá trình chuyên sâu thường mất khoảng 40–60 giây. Vui lòng giữ nguyên màn hình để nhận kết quả đầy đủ.
            </p>

            <div className="mt-7 rounded-xl border border-border bg-background/85 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 text-xs font-black">
                <span className="flex items-center gap-2 text-primary" aria-live="polite">
                  <Loader2 className="animate-spin" size={15} />
                  {statusText}
                </span>
                <span className="shrink-0 text-muted-foreground">{progress}%</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <div className="h-full rounded-full bg-gradient-to-r from-primary via-red-500 to-amber-400 transition-[width] duration-700 ease-out" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-right text-[11px] font-bold text-muted-foreground">Đã xử lý {elapsedSeconds} giây</p>
            </div>
          </div>

          <div className="relative border-t border-border bg-background/62 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <p className="text-sm font-black text-foreground">Tiến độ xử lý hồ sơ</p>
            <div className="mt-5 space-y-4">
              {progressSteps.map((step, index) => {
                const Icon = step.icon;
                const completed = index < activeStep;
                const active = index === activeStep;
                return (
                  <div key={step.label} className={`flex gap-3 rounded-xl border p-3 transition ${active ? "border-primary/35 bg-primary/5" : "border-transparent"}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${completed ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {completed ? <Check size={17} /> : active ? <Loader2 className="animate-spin" size={17} /> : <Icon size={17} />}
                    </span>
                    <div>
                      <p className={`text-sm font-black ${active ? "text-primary" : "text-foreground"}`}>{step.label}</p>
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
