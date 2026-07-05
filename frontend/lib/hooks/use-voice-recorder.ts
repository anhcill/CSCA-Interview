"use client";

import { useCallback, useRef, useState } from "react";
import { blobToBase64, transcribeAudio, type TranscribeResponse } from "../speech-client";

export type VoiceRecorderState = "idle" | "recording" | "transcribing";

export type VoiceRecorderResult = TranscribeResponse & {
  audioBase64?: string;
  mimeType?: string;
  source: "browser" | "server";
};

type UseVoiceRecorderOptions = {
  language?: "vi" | "zh" | "en";
  onAutoSubmitCountdown?: (seconds: number | null) => void;
  onError?: (error: string) => void;
  onInterimTranscript?: (text: string) => void;
  onNoSpeech?: () => void;
  onTranscript?: (text: string, result?: VoiceRecorderResult) => void;
  onTranscriptionResult?: (result: VoiceRecorderResult) => void;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type SpeechRecognitionLike = {
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function toSpeechRecognitionLang(language?: "vi" | "zh" | "en") {
  if (language === "zh") return "zh-CN";
  if (language === "en") return "en-US";
  return "vi-VN";
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const { language, onAutoSubmitCountdown, onError, onInterimTranscript, onNoSpeech, onTranscript, onTranscriptionResult } = options;
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionTranscriptRef = useRef("");
  const recognitionFatalErrorRef = useRef(false);
  const shouldKeepListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const finalizeTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceFrameRef = useRef<number | null>(null);
  const silenceStartedAtRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const stopReasonRef = useRef<"cancel" | "manual" | "silence">("manual");

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const clearFinalizeTimer = useCallback(() => {
    if (finalizeTimerRef.current !== null) {
      window.clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    onAutoSubmitCountdown?.(null);
  }, [onAutoSubmitCountdown]);

  const cleanupAudioMonitor = useCallback(() => {
    if (silenceFrameRef.current !== null) {
      window.cancelAnimationFrame(silenceFrameRef.current);
      silenceFrameRef.current = null;
    }
    silenceStartedAtRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  const startSilenceMonitor = useCallback((stream: MediaStream, recorder: MediaRecorder) => {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (recorder.state !== "recording") return;

      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      const hasStartedSpeaking = now - recordingStartedAtRef.current > 1200;

      if (hasStartedSpeaking && rms < 0.014) {
        silenceStartedAtRef.current ??= now;
        if (now - silenceStartedAtRef.current > 1600) {
          stopReasonRef.current = "silence";
          recorder.stop();
          return;
        }
      } else {
        silenceStartedAtRef.current = null;
      }

      silenceFrameRef.current = window.requestAnimationFrame(tick);
    };

    silenceFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const startRecording = useCallback(async () => {
    shouldKeepListeningRef.current = true;
    clearFinalizeTimer();

    const canRecordServerAudio =
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined";
    const SpeechRecognition = canRecordServerAudio ? null : getSpeechRecognitionConstructor();
    if (SpeechRecognition) {
      const finalizeTranscript = () => {
        const text = recognitionTranscriptRef.current.trim();
        if (!text) return;
        shouldKeepListeningRef.current = false;
        clearFinalizeTimer();
        clearRestartTimer();
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        setState("idle");
        setTranscript(text);
        const result: VoiceRecorderResult = {
          language: language ?? "vi",
          source: "browser",
          text
        };
        onTranscriptionResult?.(result);
        onTranscript?.(text, result);
      };

      const scheduleFinalize = () => {
        clearFinalizeTimer();
        const startedAt = Date.now();
        const waitMs = 3500;
        onAutoSubmitCountdown?.(Math.ceil(waitMs / 1000));
        countdownTimerRef.current = window.setInterval(() => {
          const remaining = Math.max(0, waitMs - (Date.now() - startedAt));
          onAutoSubmitCountdown?.(remaining > 0 ? Math.ceil(remaining / 1000) : null);
        }, 250);
        finalizeTimerRef.current = window.setTimeout(finalizeTranscript, 3500);
      };

      const beginRecognition = (resetTranscript = false) => {
        clearRestartTimer();
        if (resetTranscript) recognitionTranscriptRef.current = "";
        recognitionFatalErrorRef.current = false;

        const recognition = new SpeechRecognition();
        recognition.lang = toSpeechRecognitionLang(language);
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          let finalText = "";
          let interimText = "";

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const text = result[0]?.transcript.trim() ?? "";
            if (!text) continue;
            if (result.isFinal) finalText += `${text} `;
            else interimText += `${text} `;
          }

          const nextText = `${recognitionTranscriptRef.current} ${finalText || interimText}`.trim();
          if (nextText) {
            setTranscript(nextText);
            onInterimTranscript?.(nextText);
          }
          if (interimText.trim()) {
            clearFinalizeTimer();
          }
          if (finalText.trim()) {
            recognitionTranscriptRef.current = `${recognitionTranscriptRef.current} ${finalText}`.trim();
            scheduleFinalize();
          }
        };

        recognition.onerror = (event) => {
          if (event.error === "no-speech") {
            if (!recognitionTranscriptRef.current.trim()) {
              shouldKeepListeningRef.current = false;
              clearFinalizeTimer();
              clearRestartTimer();
              onNoSpeech?.();
            }
            return;
          }

          if (event.error === "aborted") {
            recognitionFatalErrorRef.current = !shouldKeepListeningRef.current;
            return;
          }

          recognitionFatalErrorRef.current = true;
          shouldKeepListeningRef.current = false;

          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            onError?.("Không thể truy cập microphone");
            return;
          }

          onError?.("Lỗi nhận dạng giọng nói");
        };

        recognition.onend = () => {
          recognitionRef.current = null;

          if (shouldKeepListeningRef.current && !recognitionFatalErrorRef.current) {
            setState("recording");
            restartTimerRef.current = window.setTimeout(() => {
              if (shouldKeepListeningRef.current && !recognitionRef.current) {
                beginRecognition(false);
              }
            }, 450);
            return;
          }

          setState("idle");
        };

        recognitionRef.current = recognition;
        setState("recording");
        recognition.start();
      };

      try {
        beginRecognition(true);
        return;
      } catch {
        recognitionRef.current = null;
        setState("idle");
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      stopReasonRef.current = "manual";

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const stopReason = stopReasonRef.current;
        stopReasonRef.current = "manual";
        cleanupAudioMonitor();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (stopReason === "cancel") {
          setState("idle");
          return;
        }

        if (blob.size < 100) {
          setState("idle");
          if (stopReason === "silence") onNoSpeech?.();
          return;
        }

        setState("transcribing");

        try {
          const base64 = await blobToBase64(blob);
          const cleanMimeType = mimeType.split(";")[0] ?? mimeType;
          const result = await transcribeAudio(base64, cleanMimeType, language);
          if (!result.text.trim()) {
            if (stopReason === "silence") onNoSpeech?.();
            return;
          }

          const payload: VoiceRecorderResult = {
            ...result,
            audioBase64: base64,
            mimeType: cleanMimeType,
            source: "server"
          };
          setTranscript(result.text);
          onTranscriptionResult?.(payload);
          onTranscript?.(result.text, payload);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Lỗi nhận dạng giọng nói";
          onError?.(message);
        } finally {
          setState("idle");
        }
      };

      recorder.start(250);
      startSilenceMonitor(stream, recorder);
      setState("recording");
    } catch (error) {
      cleanupAudioMonitor();
      const message = error instanceof Error ? error.message : "Không thể truy cập microphone";
      onError?.(message);
      setState("idle");
    }
  }, [cleanupAudioMonitor, clearFinalizeTimer, clearRestartTimer, language, onAutoSubmitCountdown, onError, onInterimTranscript, onNoSpeech, onTranscript, onTranscriptionResult, startSilenceMonitor]);

  const stopRecording = useCallback(() => {
    shouldKeepListeningRef.current = false;
    clearFinalizeTimer();
    clearRestartTimer();

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      stopReasonRef.current = "manual";
      mediaRecorderRef.current.stop();
    }
  }, [clearFinalizeTimer, clearRestartTimer]);

  const toggleRecording = useCallback(() => {
    if (state === "recording") {
      stopRecording();
    } else if (state === "idle") {
      startRecording();
    }
  }, [state, startRecording, stopRecording]);

  const cancelRecording = useCallback(() => {
    shouldKeepListeningRef.current = false;
    clearFinalizeTimer();
    clearRestartTimer();

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      stopReasonRef.current = "cancel";
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    cleanupAudioMonitor();
    setState("idle");
  }, [cleanupAudioMonitor, clearFinalizeTimer, clearRestartTimer]);

  return {
    cancelRecording,
    isRecording: state === "recording",
    isTranscribing: state === "transcribing",
    startRecording,
    state,
    stopRecording,
    toggleRecording,
    transcript
  };
}
