"use client";

import { useEffect, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import type { VoiceRecorderState } from "@/lib/hooks/use-voice-recorder";

type VoiceRecorderProps = {
  state: VoiceRecorderState;
  transcript: string;
  onToggle: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

export function VoiceRecorder({ state, transcript, onToggle, onCancel, disabled }: VoiceRecorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecording = ["LISTENING", "SPEECH_DETECTED", "WAITING_FOR_MORE"].includes(state);
  const isTranscribing = state === "TRANSCRIBING";

  useEffect(() => {
    if (!isRecording) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      analyserRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      // Draw flat line
      drawFlatLine();
      return;
    }

    let ctx: AudioContext | null = null;

    async function startVisualizer() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        drawWaveform();
      } catch {
        drawFlatLine();
      }
    }

    startVisualizer();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      ctx?.close();
    };
  }, [isRecording]);

  function drawWaveform() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      if (!analyser || !canvasCtx || !canvas) return;
      animFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = "#f8faff";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#1f62e0";
      canvasCtx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    }

    draw();
  }

  function drawFlatLine() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#f8faff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#d2deee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }

  return (
    <div className="rounded-2xl border border-[#d2deee] bg-[#f8faff] p-4">
      <canvas
        ref={canvasRef}
        width={400}
        height={60}
        className="mb-3 w-full rounded-xl"
      />

      {transcript && state === "REVIEW" ? (
        <p className="mb-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#243252] border border-[#d2deee]">
          {transcript}
        </p>
      ) : null}

      {isTranscribing ? (
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-600">
          <Loader2 size={14} className="animate-spin" />
          Đang chuyển giọng nói thành văn bản...
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled || isTranscribing}
          className={`flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-black text-white shadow-lg transition ${
            isRecording
              ? "bg-[#f3374d] shadow-red-500/25 hover:bg-[#d92c3d]"
              : "bg-[#0a9f7a] shadow-emerald-500/25 hover:bg-[#088a6a]"
          } disabled:opacity-45 disabled:cursor-not-allowed`}
        >
          {isRecording ? (
            <>
              <Square size={16} fill="currentColor" /> Dừng ghi
            </>
          ) : (
            <>
              <Mic size={16} /> Bắt đầu ghi
            </>
          )}
        </button>

        {isRecording ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#d8e3f2] px-4 py-3 text-sm font-black text-[#51607b] hover:bg-[#f3f7ff]"
          >
            Hủy
          </button>
        ) : null}

        <span className="ml-auto text-xs font-bold text-[#8794aa]">
          {isRecording ? "🔴 Đang ghi âm..." : isTranscribing ? "⏳ Đang xử lý..." : "Sẵn sàng"}
        </span>
      </div>
    </div>
  );
}
