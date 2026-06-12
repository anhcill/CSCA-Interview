"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

type CriteriaAverages = {
  confidence: number;
  content: number;
  expertise: number;
  impression: number;
  language: number;
  logic: number;
};

const criteriaLabels: Record<string, string> = {
  confidence: "Tự tin",
  content: "Nội dung",
  expertise: "Chuyên ngành",
  impression: "Ấn tượng",
  language: "Ngôn ngữ",
  logic: "Logic"
};

export function ScoreRadarChart({ data }: { data: CriteriaAverages }) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    criterion: criteriaLabels[key] ?? key,
    fullMark: 10,
    score: value
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
          <PolarGrid stroke="rgba(148, 163, 184, 0.46)" />
          <PolarAngleAxis dataKey="criterion" tick={{ fill: "currentColor", fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: "currentColor", fontSize: 10 }} tickCount={6} />
          <Radar name="Điểm" dataKey="score" stroke="#2563eb" fill="#2563eb" fillOpacity={0.28} strokeWidth={2} />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}/10`, "Điểm"]} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
