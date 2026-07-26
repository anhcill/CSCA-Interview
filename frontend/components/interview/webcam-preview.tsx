"use client";

import { Camera, CameraOff } from "lucide-react";
import type { RefObject } from "react";

type WebcamPreviewProps = {
  activeSubtitle?: string;
  isCameraOn: boolean;
  onToggleCamera: () => void;
  questionText: string;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function WebcamPreview({ activeSubtitle, isCameraOn, onToggleCamera, questionText, videoRef }: WebcamPreviewProps) {
  return (
    <section
      className="grid gap-4 rounded-3xl border border-[#E8E3DF] bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_280px] md:items-stretch xl:grid-cols-[minmax(0,1fr)_320px]"
      aria-label="Câu hỏi hiện tại và camera"
    >
      <div className="flex min-h-[164px] items-center justify-between gap-4 rounded-2xl bg-[#2B231F] p-5 text-white shadow-inner sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-300">AI Interviewer đang hỏi</p>
          <p className="text-base font-extrabold leading-7 text-white sm:text-lg">{questionText}</p>
          {activeSubtitle ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">{activeSubtitle}</p> : null}
        </div>
        <div className="flex h-7 shrink-0 items-end gap-1" aria-hidden="true">
          <WaveBar height="70%" delay="0.1s" />
          <WaveBar height="100%" delay="0.3s" />
          <WaveBar height="40%" delay="0.5s" />
          <WaveBar height="80%" delay="0.2s" />
          <WaveBar height="50%" delay="0.4s" />
        </div>
      </div>

      <div className="relative aspect-video w-full max-w-sm justify-self-end overflow-hidden rounded-2xl border border-[#D9D1CC] bg-[#E8E3DF] shadow-sm md:max-w-none">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover transition-opacity duration-300 ${isCameraOn ? "opacity-100" : "absolute opacity-0"}`}
        />

        {!isCameraOn ? <CameraPlaceholder /> : null}

        {isCameraOn ? (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#2B231F]/55 px-2.5 py-1 text-[9px] font-extrabold tracking-wider text-white backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF453A]" />
            <span>LIVE</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onToggleCamera}
          className="absolute right-2.5 top-2.5 rounded-full border border-white/10 bg-[#2B231F]/55 p-2 text-white shadow-md backdrop-blur-md transition hover:bg-[#2B231F]/75"
          title={isCameraOn ? "Tắt camera" : "Bật camera"}
          aria-label={isCameraOn ? "Tắt camera" : "Bật camera"}
        >
          {isCameraOn ? <CameraOff size={14} /> : <Camera size={14} />}
        </button>
      </div>
    </section>
  );
}

function CameraPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#FDF8F5] to-[#E8E3DF] px-4 text-center text-[#8C837E]">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#E3DCD8] shadow-inner">
        <CameraOff size={24} className="text-[#8C837E]" />
      </div>
      <p className="text-xs font-extrabold text-[#2B231F]">Camera đang tắt</p>
      <p className="mt-1 text-[10px] text-[#8C837E]">Bật camera để phân tích giao tiếp.</p>
    </div>
  );
}

function WaveBar({ delay, height }: { delay: string; height: string }) {
  return <span className="w-[3px] rounded-full bg-sky-400 animate-wave-bar" style={{ height, animationDelay: delay }} />;
}
