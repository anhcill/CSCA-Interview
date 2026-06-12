"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function ProgressLineChart({ data }: { data: { label: string; score: number }[] }) {
  const chartData = data.length ? data : [{ label: "Chưa có", score: 0 }];

  return (
    <div className="h-64 w-full" role="img" aria-label="Biểu đồ điểm theo thời gian">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ bottom: 8, left: -20, right: 16, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.32)" />
          <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 12 }} />
          <YAxis domain={[0, 10]} tick={{ fill: "currentColor", fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}/10`, "Điểm"]} />
          <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SkillRadarMini({
  data
}: {
  data: { content: number; expertise: number; language: number; logic: number; overall: number };
}) {
  const chartData = [
    { label: "Nội dung", score: data.content },
    { label: "Logic", score: data.logic },
    { label: "Ngôn ngữ", score: data.language },
    { label: "Chuyên ngành", score: data.expertise },
    { label: "Tổng", score: data.overall }
  ];

  return (
    <div className="h-64 w-full" role="img" aria-label="Radar điểm kỹ năng">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius="72%">
          <PolarGrid stroke="rgba(148, 163, 184, 0.45)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.28} strokeWidth={2} />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}/10`, "Điểm"]} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
