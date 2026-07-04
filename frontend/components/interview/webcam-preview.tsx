"use client";

import { Camera, CameraOff, Settings } from "lucide-react";
import type { RefObject } from "react";
import { VisualMetricsOverlay, type VisualMetrics, type VisualMetricsStatus } from "./visual-metrics-panel";

type WebcamPreviewProps = {
  activeSubtitle?: string;
  isCameraOn: boolean;
  metrics: VisualMetrics;
  metricsStatus?: VisualMetricsStatus;
  onToggleCamera: () => void;
  questionText: string;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function WebcamPreview({ activeSubtitle, isCameraOn, metrics, metricsStatus, onToggleCamera, questionText, videoRef }: WebcamPreviewProps) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-3xl border border-[#E8E3DF] bg-[#E8E3DF] shadow-sm lg:min-h-0">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full min-h-[360px] w-full object-cover transition-opacity duration-500 ${isCameraOn ? "opacity-100" : "absolute opacity-0"}`}
      />

      {!isCameraOn ? <CameraPlaceholder /> : null}

      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#2B231F]/40 px-3 py-1.5 text-[10px] font-extrabold tracking-wider text-white backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-[#FF453A] animate-pulse" />
        <span>LIVE</span>
      </div>

      <button
        type="button"
        onClick={onToggleCamera}
        className="absolute right-4 top-4 rounded-full border border-white/10 bg-[#2B231F]/40 p-2 text-white shadow-md backdrop-blur-md transition hover:bg-[#2B231F]/60"
        title={isCameraOn ? "Tắt camera" : "Bật camera"}
        aria-label={isCameraOn ? "Tắt camera" : "Bật camera"}
      >
        {isCameraOn ? <Settings size={15} /> : <Camera size={15} />}
      </button>

      <VisualMetricsOverlay metrics={metrics} status={metricsStatus} />

      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#2B231F]/80 p-4 text-white shadow-lg backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-sky-300">AI Interviewer đang nói...</p>
          <p className="text-sm font-extrabold leading-relaxed text-white">{questionText}</p>
          {activeSubtitle ? <p className="mt-1 text-xs font-semibold text-slate-300">{activeSubtitle}</p> : null}
        </div>
        <div className="flex h-5 shrink-0 items-end gap-0.5" aria-hidden="true">
          <WaveBar height="70%" delay="0.1s" />
          <WaveBar height="100%" delay="0.3s" />
          <WaveBar height="40%" delay="0.5s" />
          <WaveBar height="80%" delay="0.2s" />
          <WaveBar height="50%" delay="0.4s" />
        </div>
      </div>
    </div>
  );
}

function CameraPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#FDF8F5] to-[#E8E3DF] px-6 text-center text-[#8C837E]">
      <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[#E3DCD8] shadow-inner">
        <CameraOff size={38} className="text-[#8C837E]" />
      </div>
      <p className="text-sm font-extrabold text-[#2B231F]">Camera đang tắt</p>
      <p className="mt-1 text-xs text-[#8C837E]">Bật camera để hệ thống kiểm tra khuôn mặt và ánh sáng.</p>
    </div>
  );
}

function WaveBar({ delay, height }: { delay: string; height: string }) {
  return <span className="w-[3px] rounded-full bg-sky-400 animate-wave-bar" style={{ height, animationDelay: delay }} />;
}
