"use client";

import { Activity, Eye, Lightbulb, MessageSquare, Sparkles, Target, UserCheck } from "lucide-react";
import type { ComponentType } from "react";

export type VisualMetrics = {
  communication: number;
  confidence: number;
  eyeContact: number;
  focus: number;
  stress: number;
};

type MetricKey = keyof VisualMetrics;

type MetricConfig = {
  Icon: ComponentType<{ size?: number; className?: string }>;
  barClassName: string;
  key: MetricKey;
  label: string;
  softClassName: string;
  textClassName: string;
};

const metricConfigs: MetricConfig[] = [
  {
    Icon: Sparkles,
    barClassName: "bg-[#8A2BE2]",
    key: "confidence",
    label: "Tự tin",
    softClassName: "bg-[#F5E6FF]",
    textClassName: "text-[#8A2BE2]"
  },
  {
    Icon: Target,
    barClassName: "bg-[#007BFF]",
    key: "focus",
    label: "Tập trung",
    softClassName: "bg-[#E8F4FF]",
    textClassName: "text-[#007BFF]"
  },
  {
    Icon: MessageSquare,
    barClassName: "bg-[#28A745]",
    key: "communication",
    label: "Giao tiếp",
    softClassName: "bg-[#EBFDF2]",
    textClassName: "text-[#28A745]"
  },
  {
    Icon: Activity,
    barClassName: "bg-[#FD7E14]",
    key: "stress",
    label: "Căng thẳng",
    softClassName: "bg-[#FFF5E6]",
    textClassName: "text-[#FD7E14]"
  },
  {
    Icon: Eye,
    barClassName: "bg-[#0EA5E9]",
    key: "eyeContact",
    label: "Eye Contact",
    softClassName: "bg-[#E0F2FE]",
    textClassName: "text-[#0284C7]"
  }
];

export function getVisualMetricLabel(key: MetricKey, value: number) {
  if (key === "stress") {
    if (value < 30) return "Thấp";
    if (value < 55) return "Vừa";
    return "Cao";
  }

  if (value >= 85) return "Tốt";
  if (value >= 70) return "Khá tốt";
  if (value >= 50) return "Ổn";
  return "Cần cải thiện";
}

export function VisualMetricsPanel({ metrics }: { metrics: VisualMetrics }) {
  return (
    <div className="flex flex-1 flex-col gap-4 rounded-3xl border border-[#F0EBE7] bg-white p-5 shadow-sm lg:h-[50%]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold text-[#2B231F]">Phân tích biểu cảm</h3>
        <span className="rounded-lg bg-[#EBFDF2] px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-[#28A745]">Realtime</span>
      </div>

      <div className="space-y-3">
        {metricConfigs.map((metric) => (
          <MetricRow key={metric.key} config={metric} value={metrics[metric.key]} />
        ))}
      </div>

      <div className="mt-auto flex items-start gap-2.5 rounded-2xl border border-orange-100 bg-[#FFF5E6]/40 p-3">
        <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="text-[11px] font-bold leading-relaxed text-[#8C837E]">
          Hãy giữ bình tĩnh, nhìn vào camera và trả lời gọn ý để điểm giao tiếp ổn định hơn.
        </p>
      </div>
    </div>
  );
}

export function VisualMetricsSummary({ metrics }: { metrics: VisualMetrics }) {
  return (
    <div className="rounded-3xl border border-[#F0EBE7] bg-white p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-[#2B231F]">Phân tích tổng quan</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {metricConfigs.map((metric) => (
          <SummaryTile key={metric.key} config={metric} value={metrics[metric.key]} />
        ))}
      </div>
    </div>
  );
}

export function VisualMetricsOverlay({ metrics }: { metrics: VisualMetrics }) {
  return (
    <div className="absolute right-4 top-16 z-10 hidden w-[190px] flex-col gap-2.5 rounded-2xl border border-white/10 bg-[#2B231F]/70 p-4 text-white shadow-lg backdrop-blur-md transition-all duration-300 sm:flex">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
          <UserCheck size={16} />
        </div>
        <div>
          <p className="text-[10px] font-bold leading-3 text-white/60">Cảm xúc</p>
          <p className="text-xs font-extrabold leading-4 text-white">{getVisualMetricLabel("confidence", metrics.confidence)}</p>
        </div>
      </div>

      {metricConfigs.slice(1).map((metric) => (
        <div key={metric.key} className="space-y-1">
          <div className="flex justify-between text-[9px] font-bold">
            <span>{metric.label}</span>
            <span>{metrics[metric.key]}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div className={`h-full rounded-full transition-all duration-500 ${metric.barClassName}`} style={{ width: `${clampScore(metrics[metric.key])}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricRow({ config, value }: { config: MetricConfig; value: number }) {
  const Icon = config.Icon;

  return (
    <div className="grid grid-cols-[28px_minmax(72px,1fr)_minmax(92px,1.7fr)_52px] items-center gap-3">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.softClassName} ${config.textClassName}`}>
        <Icon size={13} />
      </div>
      <span className="min-w-0 text-xs font-bold text-[#2B231F]">{config.label}</span>
      <div className={`h-2 overflow-hidden rounded-full ${config.softClassName}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${config.barClassName}`} style={{ width: `${clampScore(value)}%` }} />
      </div>
      <span className={`text-right text-xs font-extrabold ${config.textClassName}`}>{getVisualMetricLabel(config.key, value)}</span>
    </div>
  );
}

function SummaryTile({ config, value }: { config: MetricConfig; value: number }) {
  return (
    <div className="flex min-h-[78px] flex-col items-center justify-between rounded-2xl border border-[#F0EBE7]/60 bg-[#FCF9F7] p-2 text-center">
      <span className="text-[9px] font-bold text-[#8C837E]">{config.label}</span>
      <span className={`text-sm font-extrabold ${config.textClassName}`}>{value}%</span>
      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-extrabold ${config.softClassName} ${config.textClassName}`}>
        {getVisualMetricLabel(config.key, value)}
      </span>
    </div>
  );
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}
