"use client";

import { useState } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";

type AudioPlayerProps = {
  text: string;
  lang?: string;
  disabled?: boolean;
  size?: "sm" | "md";
};

export function AudioPlayer({ text, lang = "zh-CN", disabled, size = "md" }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  async function handlePlay() {
    if (!text || playing || disabled) return;

    setPlaying(true);
    setError("");

    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        await speakBrowser(text, lang);
      } else {
        setError("Trình duyệt không hỗ trợ đọc giọng nói");
      }
    } catch {
      setError("Không thể phát");
    } finally {
      setPlaying(false);
    }
  }

  const iconSize = size === "sm" ? 14 : 18;
  const btnClass = size === "sm"
    ? "h-8 w-8 rounded-lg"
    : "h-10 w-10 rounded-xl";

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handlePlay}
        disabled={disabled || playing}
        className={`${btnClass} flex items-center justify-center border border-[#d8e3f2] bg-white text-[#0a347d] shadow-sm transition hover:bg-[#f3f7ff] disabled:opacity-45 disabled:cursor-not-allowed`}
        title={playing ? "Đang phát..." : "Đọc câu hỏi"}
        aria-label="Đọc câu hỏi bằng giọng nói"
      >
        {playing ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : error ? (
          <VolumeX size={iconSize} />
        ) : (
          <Volume2 size={iconSize} />
        )}
      </button>
      {error ? (
        <span className="text-xs font-bold text-red-500">{error}</span>
      ) : null}
    </div>
  );
}

function speakBrowser(text: string, lang: string) {
  return new Promise<void>((resolve, reject) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Lỗi phát giọng nói"));
    window.speechSynthesis.speak(utterance);
  });
}
