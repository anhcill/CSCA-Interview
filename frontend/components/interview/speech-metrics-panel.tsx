"use client";

import type { ReactNode } from "react";
import type { PauseDetail, PronunciationResult, PronunciationWordDetail, SpeechMetrics } from "@/lib/speech-client";

const speedLabels: Record<SpeechMetrics["speedRating"], { label: string; className: string }> = {
  fast: { label: "Hơi nhanh", className: "text-amber-700 dark:text-amber-300" },
  normal: { label: "Tốt", className: "text-emerald-700 dark:text-emerald-300" },
  slow: { label: "Hơi chậm", className: "text-amber-700 dark:text-amber-300" },
  too_fast: { label: "Quá nhanh", className: "text-red-700 dark:text-red-300" },
  too_slow: { label: "Quá chậm", className: "text-red-700 dark:text-red-300" }
};

function ScoreGauge({ label, maxScore = 100, score }: { label: string; maxScore?: number; score: number }) {
  const pct = Math.max(0, Math.min(100, (score / maxScore) * 100));
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : pct >= 40 ? "bg-orange-500" : "bg-red-500";
  const rating = pct >= 80 ? "Xuất sắc" : pct >= 60 ? "Khá" : pct >= 40 ? "Trung bình" : "Cần cải thiện";

  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-bold text-slate-700 dark:text-slate-200">{label}</span>
        <span className="font-black text-slate-900 dark:text-white">{score}/{maxScore} - {rating}</span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`${color} h-3 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function wordColor(score: number) {
  if (score >= 80) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 60) return "text-amber-700 dark:text-amber-300";
  if (score >= 40) return "text-orange-700 dark:text-orange-300";
  return "text-red-700 dark:text-red-300";
}

function errorLabel(errorType: PronunciationWordDetail["errorType"]) {
  const labels: Record<PronunciationWordDetail["errorType"], string> = {
    Insertion: "Thêm từ",
    Mispronunciation: "Phát âm sai",
    None: "",
    Omission: "Bỏ sót"
  };
  return labels[errorType];
}

function PronunciationWords({ words }: { words: PronunciationWordDetail[] }) {
  if (!words.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-black text-slate-700 dark:text-slate-200">Chi tiết từng từ</p>
      <div className="flex flex-wrap gap-2">
        {words.map((word, index) => (
          <div key={`${word.word}-${index}`} className="min-w-[56px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center dark:border-slate-800 dark:bg-slate-900">
            <span className={`block text-sm font-black ${wordColor(word.accuracyScore)}`}>{word.word}</span>
            <span className="block text-[11px] font-bold text-slate-500">{word.accuracyScore}</span>
            {word.errorType !== "None" ? (
              <span className="mt-1 inline-flex rounded border border-red-200 bg-red-50 px-1 text-[10px] font-bold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {errorLabel(word.errorType)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PronunciationPanel({ result }: { result: PronunciationResult }) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-lg font-black text-slate-950 dark:text-white">Đánh giá phát âm</h3>

      <div className="space-y-2">
        <ScoreGauge label="Phát âm" score={result.pronunciationScore} />
        <ScoreGauge label="Độ chính xác" score={result.accuracyScore} />
        <ScoreGauge label="Trôi chảy" score={result.fluencyScore} />
        <ScoreGauge label="Độ đầy đủ" score={result.completenessScore} />
      </div>

      {result.recognizedText ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          Nhận dạng: &quot;{result.recognizedText}&quot;
        </p>
      ) : null}

      <PronunciationWords words={result.words} />

      <div className="space-y-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <p className="font-black text-slate-800 dark:text-slate-100">Gợi ý phát âm</p>
        {result.pronunciationScore >= 80 ? <p>- Phát âm tốt, giữ nhịp hiện tại.</p> : null}
        {result.pronunciationScore < 60 ? <p>- Luyện phát âm lại với giọng mẫu và đọc chậm từng cụm.</p> : null}
        {result.fluencyScore < 60 ? <p>- Nói chưa liền mạch, nên luyện trả lời 60 giây không dừng quá lâu.</p> : null}
        {result.completenessScore < 70 ? <p>- Câu trả lời bị thiếu từ hoặc thiếu ý, cần nói đủ câu hơn.</p> : null}
        {result.words.some((word) => word.errorType === "Mispronunciation") ? <p>- Có từ phát âm sai, hãy luyện lại nhóm từ được đánh dấu.</p> : null}
      </div>
    </div>
  );
}

function PauseList({ pauses }: { pauses?: PauseDetail[] }) {
  const visiblePauses = pauses?.filter((pause) => pause.category !== "short").slice(0, 3) ?? [];
  if (!visiblePauses.length) return null;

  return (
    <div className="space-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
      {visiblePauses.map((pause, index) => (
        <p key={`${pause.context}-${index}`}>- {pause.context}</p>
      ))}
    </div>
  );
}

export function SpeechMetricsPanel({ metrics }: { metrics: SpeechMetrics }) {
  const speed = speedLabels[metrics.speedRating];
  const unitLabel = metrics.language === "zh" ? "ký tự/phút" : "WPM";

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-lg font-black text-slate-950 dark:text-white">Phân tích giọng nói</h3>

      <div className="space-y-2">
        <ScoreGauge label="Độ trôi chảy" score={metrics.fluencyScore} />
        {metrics.confidenceScore != null ? <ScoreGauge label="Độ tự tin" score={metrics.confidenceScore} /> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <MetricBox value={metrics.wpm} label={unitLabel} detail={<span className={speed.className}>{speed.label}</span>} />
        <MetricBox value={`${metrics.durationSec}s`} label="Thời lượng" detail={`${metrics.wordCount} ${metrics.language === "zh" ? "ký tự" : "từ"}`} />
        <MetricBox value={metrics.pauseCount} label="Ngắt nghỉ dài" detail={metrics.longestPauseSec > 0 ? `Max ${metrics.longestPauseSec}s` : ""} />
        <MetricBox
          value={metrics.fillerWordTotal}
          label="Từ đệm"
          detail={metrics.fillerWords.slice(0, 3).map((item) => `${item.word} x${item.count}`).join(", ")}
        />
      </div>

      {metrics.confidenceFactors ? (
        <div className="space-y-2">
          <p className="text-sm font-black text-slate-700 dark:text-slate-200">Yếu tố tự tin</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <MiniMetric label="Tốc độ ổn định" value={metrics.confidenceFactors.speedConsistency} />
            <MiniMetric label="Kiểm soát ngắt" value={metrics.confidenceFactors.pauseControl} />
            <MiniMetric label="Tránh từ đệm" value={metrics.confidenceFactors.fillerAvoidance} />
            <MiniMetric label="Độ dài nội dung" value={metrics.confidenceFactors.contentLength} />
          </div>
        </div>
      ) : null}

      {metrics.pausePenalty && metrics.pausePenalty.mediumCount + metrics.pausePenalty.longCount + metrics.pausePenalty.veryLongCount > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-black text-slate-700 dark:text-slate-200">Chi tiết ngắt nghỉ</p>
          <div className="flex flex-wrap gap-3 text-xs font-bold">
            {metrics.pausePenalty.shortCount > 0 ? <span>Ngắn: {metrics.pausePenalty.shortCount}</span> : null}
            {metrics.pausePenalty.mediumCount > 0 ? <span className="text-amber-700">Trung bình: {metrics.pausePenalty.mediumCount}</span> : null}
            {metrics.pausePenalty.longCount > 0 ? <span className="text-orange-700">Dài: {metrics.pausePenalty.longCount}</span> : null}
            {metrics.pausePenalty.veryLongCount > 0 ? <span className="text-red-700">Rất dài: {metrics.pausePenalty.veryLongCount}</span> : null}
          </div>
          <PauseList pauses={metrics.pauses} />
        </div>
      ) : null}

      <div className="space-y-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <p className="font-black text-slate-800 dark:text-slate-100">Gợi ý</p>
        {metrics.speedRating === "too_slow" ? <p>- Cố gắng nói nhanh hơn, tránh ngập ngừng quá lâu.</p> : null}
        {metrics.speedRating === "slow" ? <p>- Tốc độ hơi chậm, hãy giữ nhịp nói đều hơn.</p> : null}
        {metrics.speedRating === "too_fast" ? <p>- Nói chậm lại để phát âm rõ hơn.</p> : null}
        {metrics.speedRating === "fast" ? <p>- Tốc độ hơi nhanh, giảm nhịp ở ý quan trọng.</p> : null}
        {metrics.speedRating === "normal" ? <p>- Tốc độ nói tốt, giữ nhịp hiện tại.</p> : null}
        {metrics.pauseCount > 3 ? <p>- Giảm số lần ngắt nghỉ dài bằng cách chuẩn bị dàn ý trước khi nói.</p> : null}
        {metrics.longestPauseSec > 5 ? <p>- Có đoạn ngắt trên 5 giây, nên nghĩ ý chính trước khi bắt đầu trả lời.</p> : null}
        {metrics.fillerWordTotal > 5 ? <p>- Giảm từ đệm bằng cách dừng ngắn thay vì nói uh, um, ờ.</p> : null}
        {metrics.wordCount < 20 ? <p>- Câu trả lời còn ngắn, nên thêm ví dụ và kế hoạch cụ thể.</p> : null}
      </div>
    </div>
  );
}

function MetricBox({ detail, label, value }: { detail?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
      <div className="text-2xl font-black text-slate-950 dark:text-white">{value}</div>
      <div className="text-xs font-bold text-slate-500">{label}</div>
      {detail ? <div className="mt-1 text-xs font-bold text-slate-400">{detail}</div> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
      <span className="text-slate-500">{label}</span>
      <div className="font-black text-slate-900 dark:text-white">{value}/100</div>
    </div>
  );
}
