"use client";

import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Keyboard,
  Mic,
  Pause,
  Phone,
  Play,
  RotateCcw,
  Send,
  SkipForward,
  Square,
  Timer,
  Video,
  Volume2,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  activeInterviewSessionStorageKey,
  completeInterviewSession,
  createInterviewSession,
  fetchInterviewSession,
  fetchNextInterviewQuestion,
  pauseInterviewSession,
  resumeInterviewSession,
  skipInterviewQuestion,
  submitInterviewAnswer,
  type InterviewQuestionDto,
} from "@/lib/interview-client";
import {
  backendLanguageToBrowserSpeechLang,
  backendLanguageToSpeechLocale,
  getStoredInterviewLanguageMode,
  getStoredLocale,
  interpolate,
  interviewModeToBackendLanguage,
  localeChangedEvent,
  messages,
  setStoredInterviewLanguageMode,
  type BackendLanguage,
  type InterviewLanguageMode,
  type Locale
} from "@/lib/i18n";
import { type VoiceRecorderResult, useVoiceRecorder } from "@/lib/hooks/use-voice-recorder";
import { type FaceAnalysisStatus, useFaceAnalysis } from "@/lib/hooks/use-face-analysis";
import { assessPronunciation, playBase64Audio, synthesizeSpeech, type PronunciationResult, type SpeechMetrics } from "@/lib/speech-client";
import type { VisualCheckState } from "@/lib/visual-analysis";
import { CameraCheckPanel, type CameraCheckStatus, type CameraSystemChecks } from "./camera-check-panel";
import { ChatMessage, interviewQuestions } from "./interview-data";
import { PronunciationPanel, SpeechMetricsPanel } from "./speech-metrics-panel";
import { VisualMetricsPanel, VisualMetricsSummary, type VisualMetricsStatus } from "./visual-metrics-panel";
import { WebcamPreview } from "./webcam-preview";

type RoomQuestion = {
  aiReason?: string | null;
  category: string;
  difficulty?: string;
  expectedAnswerLogic?: string | null;
  followUpDepth?: number;
  id: string;
  isFollowUp?: boolean;
  language?: BackendLanguage;
  questionText: string;
  source?: string;
  translation?: string | null;
};

const fallbackQuestions: RoomQuestion[] = interviewQuestions.map((question, index) => ({
  category: question.category,
  expectedAnswerLogic: question.vi,
  id: `fallback-${index}`,
  questionText: question.zh,
  translation: question.vi
}));

const speechVoiceStorageKey = "ai_phongvan_speech_voice";
const speechRateStorageKey = "ai_phongvan_speech_rate";
type SpeechVoicePreset = "auto" | "female" | "male" | "warm" | "slow" | "clear";
type SpeechRate = 0.5 | 0.75 | 1 | 1.25 | 1.5;
type RemoteSpeechVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
type LastFeedback = {
  feedback: string | null;
  improvedAnswer: string | null;
  scoreTotal: string | null;
};

type SpeechSubmitPayload = {
  pronunciation?: PronunciationResult | null;
  result?: VoiceRecorderResult;
};

const voicePresets: SpeechVoicePreset[] = ["auto", "female", "male", "warm", "slow", "clear"];
const speechRates: SpeechRate[] = [0.5, 0.75, 1, 1.25, 1.5];

class MissingBrowserVoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingBrowserVoiceError";
  }
}

export function InterviewRoom() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const [locale, setLocale] = useState<Locale>("vi");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLanguage, setSessionLanguage] = useState<BackendLanguage>("ZH");
  const [interviewLanguageMode, setInterviewLanguageMode] = useState<InterviewLanguageMode>("ZH");
  const [plannedDurationMinutes, setPlannedDurationMinutes] = useState<number | null>(null);
  const [questions, setQuestions] = useState<RoomQuestion[]>(fallbackQuestions);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [messagesList, setMessagesList] = useState<ChatMessage[]>([
    buildAiMessage(fallbackQuestions[0], 1, getStoredInterviewLanguageMode(), "10:30")
  ]);
  const [input, setInput] = useState("");
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUpdatingPause, setIsUpdatingPause] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interviewMode, setInterviewMode] = useState<"TEXT" | "VOICE" | "HYBRID">("HYBRID");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [displayedQuestion, setDisplayedQuestion] = useState("");
  const [error, setError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState<LastFeedback | null>(null);
  const [lastSpeechMetrics, setLastSpeechMetrics] = useState<SpeechMetrics | null>(null);
  const [lastPronunciation, setLastPronunciation] = useState<PronunciationResult | null>(null);
  const [isAssessingPronunciation, setIsAssessingPronunciation] = useState(false);
  const [speechNotice, setSpeechNotice] = useState("");
  const [mounted, setMounted] = useState(false);
  const [selectedVoicePreset, setSelectedVoicePreset] = useState<SpeechVoicePreset>("auto");
  const [selectedSpeechRate, setSelectedSpeechRate] = useState<SpeechRate>(1);
  const [showChat, setShowChat] = useState(true);

  const handleFaceAnalysisError = useCallback((message: string) => {
    setError(message);
  }, []);

  const faceAnalysis = useFaceAnalysis({
    autoStart: mounted && !isLoadingSession,
    includeAudioCheck: false,
    onError: handleFaceAnalysisError
  });
  const visualMetrics = faceAnalysis.snapshot.scores;
  const visualMetricsStatus = getVisualMetricsStatus(faceAnalysis.status, faceAnalysis.snapshot.timestamp);
  const isCameraOn = Boolean(faceAnalysis.stream);
  const isCameraBusy = faceAnalysis.status === "loading" || faceAnalysis.status === "ready";
  const cameraButtonLabel = isCameraBusy ? "Đang bật camera" : isCameraOn ? "Tắt camera" : "Bật camera";

  const toggleCamera = useCallback(() => {
    if (isCameraBusy) return;
    if (isCameraOn) {
      faceAnalysis.stop();
    } else {
      void faceAnalysis.start();
    }
  }, [faceAnalysis, isCameraBusy, isCameraOn]);

  const isCompletingRef = useRef(false);
  const lastAutoSpokenQuestionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const t = messages[locale].interview;
  const isBilingual = interviewLanguageMode === "BILINGUAL";

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(speechVoiceStorageKey);
    if (isSpeechVoicePreset(stored)) setSelectedVoicePreset(stored);
    const storedRate = Number(localStorage.getItem(speechRateStorageKey));
    if (isSpeechRate(storedRate)) setSelectedSpeechRate(storedRate);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.getVoices();
  }, []);

  const voiceRecorder = useVoiceRecorder({
    language: backendLanguageToSpeechLocale(sessionLanguage),
    onAutoSubmitCountdown: setAutoSubmitCountdown,
    onError: (message) => {
      const shouldFallbackToText = /microphone|mic|permission|not-allowed|truy c\u1eadp|truy cap|kh\u00f4ng th\u1ec3|khong the|kh\u00f4ng h\u1ed7 tr\u1ee3|khong ho tro/i.test(message);
      setError(shouldFallbackToText ? `${message}. ${t.textModeFallback}` : message);
      if (shouldFallbackToText) {
        setInterviewMode("TEXT");
      }
    },
    onInterimTranscript: (text) => {
      setLiveTranscript(text.trim());
      setInput(text.trim());
    },
    onTranscript: (text, result) => {
      const transcript = text.trim();
      if (!transcript) return;
      setAutoSubmitCountdown(null);
      setLiveTranscript("");
      setInput(transcript);
      setSpeechNotice("");
      if (result?.speechMetrics) setLastSpeechMetrics(result.speechMetrics);
      if (interviewMode !== "TEXT") {
        void submitAnswer(transcript, result);
      }
    }
  });

  const activeQuestion = questions[currentQuestion] ?? fallbackQuestions[0];
  const activeSubtitle = isBilingual ? getQuestionSupportText(activeQuestion) : null;
  const completeTargetSessionId = sessionId ?? searchParams.get("sessionId");
  const cameraChecks = useMemo<CameraSystemChecks>(() => {
    const checks = faceAnalysis.snapshot.checks;

    return {
      camera: mapVisualCheckToCameraStatus(checks.camera, faceAnalysis.status),
      centerFace: mapVisualCheckToCameraStatus(checks.centered, faceAnalysis.status),
      faceVisible: mapVisualCheckToCameraStatus(checks.faceVisible, faceAnalysis.status),
      lighting: mapVisualCheckToCameraStatus(checks.lighting, faceAnalysis.status),
      mic: voiceRecorder.isRecording ? "ok" : "idle"
    };
  }, [faceAnalysis.snapshot.checks, faceAnalysis.status, voiceRecorder.isRecording]);
  const activeQuestionDisplay = useMemo(() => {
    return getQuestionDisplayText(activeQuestion, interviewLanguageMode);
  }, [activeQuestion, interviewLanguageMode]);
  const totalQuestions = questions.length;
  const plannedDurationSeconds = plannedDurationMinutes ? plannedDurationMinutes * 60 : null;
  const remainingSeconds = plannedDurationSeconds === null ? null : Math.max(0, plannedDurationSeconds - elapsedSeconds);
  const progress = useMemo(() => ((currentQuestion + 1) / totalQuestions) * 100, [currentQuestion, totalQuestions]);
  const progressLabel = interpolate(t.questionProgress, { current: currentQuestion + 1, total: totalQuestions });
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [error, isThinking, liveTranscript, messagesList]);

  const speakText = useCallback(async (text: string, options: { startListeningAfter?: boolean } = {}) => {
    if (!text || isSpeaking) return;

    setIsSpeaking(true);
    setError("");
    const speechLang = inferSpeechLang(text, backendLanguageToBrowserSpeechLang(sessionLanguage));
    const canUseBrowserSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
    const remotePreset = getRemoteSpeechPreset(selectedVoicePreset, speechLang, selectedSpeechRate);

    try {
      if (shouldPreferRemoteSpeech(selectedVoicePreset)) {
        try {
          const result = await synthesizeSpeech(text, remotePreset.voice, remotePreset.speed);
          await playBase64Audio(result.audio, result.contentType);
          return;
        } catch (remoteError) {
          if (!canUseBrowserSpeech) throw remoteError;
        }
      }

      if (canUseBrowserSpeech) {
        try {
          await speakWithBrowser(text, speechLang, t.browserSpeechFailed, selectedVoicePreset, selectedSpeechRate);
          return;
        } catch (err) {
          if (shouldPreferRemoteSpeech(selectedVoicePreset) || !(err instanceof MissingBrowserVoiceError)) {
            throw err;
          }
        }
      }

      const result = await synthesizeSpeech(text, remotePreset.voice, remotePreset.speed);
      await playBase64Audio(result.audio, result.contentType);
    } catch (err) {
      if (!isCompletingRef.current) {
        setError(err instanceof Error ? err.message : t.speechFailed);
      }
    } finally {
      setIsSpeaking(false);
      if (!isCompletingRef.current && options.startListeningAfter && interviewMode !== "TEXT" && !isPaused && !voiceRecorder.isRecording && !voiceRecorder.isTranscribing) {
        window.setTimeout(() => {
          if (!isCompletingRef.current) void voiceRecorder.startRecording();
        }, 250);
      }
    }
  }, [
    interviewMode,
    isPaused,
    isSpeaking,
    sessionLanguage,
    selectedVoicePreset,
    selectedSpeechRate,
    t.browserSpeechFailed,
    t.speechFailed,
    voiceRecorder
  ]);

  useEffect(() => {
    setLocale(getStoredLocale());

    function handleLocaleChanged(event: Event) {
      const nextLocale = (event as CustomEvent<{ locale: Locale }>).detail?.locale;
      if (nextLocale) setLocale(nextLocale);
    }

    window.addEventListener(localeChangedEvent, handleLocaleChanged);
    return () => window.removeEventListener(localeChangedEvent, handleLocaleChanged);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  useEffect(() => {
    setDisplayedQuestion("");

    if (prefersReducedMotion) {
      setDisplayedQuestion(activeQuestionDisplay);
      return;
    }

    let index = 0;
    const text = activeQuestionDisplay;
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayedQuestion(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 18);

    return () => window.clearInterval(timer);
  }, [activeQuestionDisplay, prefersReducedMotion]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      setInterviewMode("TEXT");
    }
  }, []);

  useEffect(() => {
    if (isLoadingSession || isPaused || interviewMode === "TEXT" || !activeQuestion?.id || !activeQuestionDisplay) {
      return;
    }

    if (lastAutoSpokenQuestionIdRef.current === activeQuestion.id) {
      return;
    }

    lastAutoSpokenQuestionIdRef.current = activeQuestion.id;
    const delay = 250;
    const timer = window.setTimeout(() => {
      if (!document.hidden) {
        void speakText(activeQuestionDisplay, { startListeningAfter: true });
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    activeQuestion.id,
    activeQuestionDisplay,
    interviewMode,
    isLoadingSession,
    isPaused,
    prefersReducedMotion,
    sessionLanguage,
    speakText
  ]);

  useEffect(() => {
    let ignore = false;

    async function bootInterview() {
      setError("");
      setIsLoadingSession(true);

      try {
        const storedSessionId = sessionStorage.getItem(activeInterviewSessionStorageKey);
        const querySessionId = searchParams.get("sessionId");
        const wantsBilingual = searchParams.get("mode") === "bilingual" || searchParams.get("bilingual") === "1";
        const storedMode = getStoredInterviewLanguageMode();
        const initialMode: InterviewLanguageMode = wantsBilingual ? "BILINGUAL" : storedMode;
        const targetSessionId = querySessionId || storedSessionId;
        const fallbackLanguage = interviewModeToBackendLanguage(initialMode);
        let createdFromStaleSession = false;
        const data = targetSessionId
          ? await fetchInterviewSession(targetSessionId).catch(async (fetchError) => {
              if (!(fetchError instanceof ApiError) || fetchError.status !== 404) {
                throw fetchError;
              }

              createdFromStaleSession = true;
              sessionStorage.removeItem(activeInterviewSessionStorageKey);
              return createInterviewSession({ language: fallbackLanguage, mode: "PRACTICE" });
            })
          : await createInterviewSession({ language: fallbackLanguage, mode: "PRACTICE" });

        if (ignore) {
          return;
        }

        const resolvedLanguage = data.session.language;
        const resolvedMode: InterviewLanguageMode = (wantsBilingual || initialMode === "BILINGUAL") && resolvedLanguage === "ZH" ? "BILINGUAL" : resolvedLanguage;

        if (data.session.status === "COMPLETED") {
          sessionStorage.setItem(activeInterviewSessionStorageKey, data.session.id);
          setStoredInterviewLanguageMode(resolvedMode);
          router.replace(`/interview/result?sessionId=${data.session.id}`);
          return;
        }

        const loadedQuestions = mapQuestions(data.session.questions);

        if (!loadedQuestions.length) {
          throw new Error(messages[getStoredLocale()].interview.noQuestions);
        }

        const nextIndex = Math.min(data.session.answeredQuestions, loadedQuestions.length - 1);

        sessionStorage.setItem(activeInterviewSessionStorageKey, data.session.id);
        setStoredInterviewLanguageMode(resolvedMode);
        setSessionId(data.session.id);
        setSessionLanguage(resolvedLanguage);
        setInterviewLanguageMode(resolvedMode);
        setPlannedDurationMinutes(data.session.plannedDurationMinutes);
        setQuestions(loadedQuestions);
        setCurrentQuestion(nextIndex);
        setIsPaused(data.session.status === "PAUSED");
        setElapsedSeconds(data.session.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(data.session.startedAt).getTime()) / 1000)) : 0);
        setMessagesList([buildAiMessage(loadedQuestions[nextIndex], 1, resolvedMode)]);

        if (createdFromStaleSession && querySessionId) {
          router.replace(`/interview?sessionId=${data.session.id}${resolvedMode === "BILINGUAL" ? "&mode=bilingual" : ""}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : messages[getStoredLocale()].interview.createFailed;
        if (err instanceof ApiError && err.status === 402) {
          router.replace(`/payment?next=${encodeURIComponent("/interview/setup")}&duration=30`);
          return;
        }

        setError(message);

        if (message.toLowerCase().includes("dang nhap") || message.toLowerCase().includes("\u0111\u0103ng nh\u1eadp")) {
          router.replace("/login");
        }
      } finally {
        if (!ignore) {
          setIsLoadingSession(false);
        }
      }
    }

    bootInterview();

    return () => {
      ignore = true;
    };
  }, [router, searchParams]);

  async function submitAnswer(answerText: string, voiceResult?: VoiceRecorderResult) {
    const answer = answerText.trim();
    if (!answer || !sessionId || isSubmitting || isPaused || isCompletingRef.current) {
      return;
    }

    const question = questions[currentQuestion];

    setIsSubmitting(true);
    setError("");
    setInput("");
    setLiveTranscript("");
    setAutoSubmitCountdown(null);
    if (!voiceResult) {
      setLastSpeechMetrics(null);
      setLastPronunciation(null);
      setSpeechNotice("");
    }
    setMessagesList((current) => [
      ...current,
      {
        id: current.length + 1,
        author: "user",
        content: answer,
        time: getClockTime()
      }
    ]);

    try {
      const speechPayload = await buildSpeechSubmitPayload(answer, voiceResult);
      const result = await submitInterviewAnswer({
        answerText: answer,
        pronunciation: speechPayload.pronunciation,
        sessionId,
        sessionQuestionId: question.id,
        speechDurationSec: speechPayload.result?.duration ?? speechPayload.result?.speechMetrics?.durationSec ?? null,
        speechLanguage: speechPayload.result?.language ?? null,
        speechMetrics: speechPayload.result?.speechMetrics ?? null,
        speechMimeType: speechPayload.result?.mimeType ?? null,
        speechTranscript: speechPayload.result?.text ?? answer
      });

      if (isCompletingRef.current) return;

      setLastFeedback({
        feedback: "Đã lưu câu trả lời. AI sẽ chấm điểm sau khi bạn hoàn thành tất cả câu hỏi.",
        improvedAnswer: null,
        scoreTotal: null
      });

      setInput("");

      if (result.session.status === "COMPLETED") {
        sessionStorage.setItem(activeInterviewSessionStorageKey, sessionId);
        router.push(`/interview/result?sessionId=${sessionId}`);
        return;
      }

      await advanceToNextQuestion(result.session.answeredQuestions);
    } catch (err) {
      if (isCompletingRef.current) return;
      setError(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      if (!isCompletingRef.current) {
        setIsSubmitting(false);
        setIsThinking(false);
      }
    }
  }

  async function buildSpeechSubmitPayload(answer: string, voiceResult?: VoiceRecorderResult): Promise<SpeechSubmitPayload> {
    if (!voiceResult) return {};

    if (voiceResult.speechMetrics) {
      setLastSpeechMetrics(voiceResult.speechMetrics);
    }

    if (voiceResult.source !== "server" || !voiceResult.audioBase64) {
      return { result: voiceResult };
    }

    setIsAssessingPronunciation(true);
    setSpeechNotice("");

    try {
      const pronunciation = await assessPronunciation(
        voiceResult.audioBase64,
        backendLanguageToSpeechLocale(sessionLanguage),
        voiceResult.text || answer
      );
      setLastPronunciation(pronunciation);
      return { pronunciation, result: voiceResult };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không chấm được phát âm.";
      setSpeechNotice(message);
      return { pronunciation: null, result: voiceResult };
    } finally {
      setIsAssessingPronunciation(false);
    }
  }

  async function advanceToNextQuestion(answeredQuestions: number) {
    if (!sessionId) return;

    setIsThinking(true);

    try {
      const nextResult = await fetchNextInterviewQuestion({
        forceAi: answeredQuestions % 2 === 0,
        sessionId
      });
      const nextRoomQuestion: RoomQuestion = {
        ...mapQuestion(nextResult.question),
        isFollowUp: nextResult.isFollowUp ?? false,
        followUpDepth: nextResult.followUpDepth ?? 0
      };
      const existingIndex = questions.findIndex((item) => item.id === nextRoomQuestion.id);
      const nextQuestionIndex = existingIndex >= 0 ? existingIndex : questions.length;

      setQuestions((current) => {
        const exists = current.some((item) => item.id === nextRoomQuestion.id);
        return exists ? current : [...current, nextRoomQuestion];
      });
      setCurrentQuestion(nextQuestionIndex);

      setMessagesList((current) => [
        ...current,
        buildAiMessage(nextRoomQuestion, current.length + 1, interviewLanguageMode, undefined, nextRoomQuestion.isFollowUp ? `[${t.followUp}] ` : "")
      ]);
      if (interviewMode !== "TEXT") {
        lastAutoSpokenQuestionIdRef.current = nextRoomQuestion.id;
        window.setTimeout(() => {
          const textToSpeak = getQuestionDisplayText(nextRoomQuestion, interviewLanguageMode);
          void speakText(textToSpeak, { startListeningAfter: true });
        }, 300);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await handleCompleteInterview();
        return;
      }
      throw err;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAnswer(input);
  }

  function handleLanguageChange(nextMode: InterviewLanguageMode) {
    setInterviewLanguageMode(nextMode);
    setStoredInterviewLanguageMode(nextMode);
    const backendLanguage = interviewModeToBackendLanguage(nextMode);
    setSessionLanguage(backendLanguage);
  }

  async function handleTogglePause() {
    if (!sessionId || isUpdatingPause || isCompletingRef.current) return;

    const nextPaused = !isPaused;
    setIsUpdatingPause(true);
    setError("");

    if (nextPaused) {
      setAutoSubmitCountdown(null);
      setLiveTranscript("");
      voiceRecorder.cancelRecording();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }

    try {
      const data = nextPaused
        ? await pauseInterviewSession(sessionId)
        : await resumeInterviewSession(sessionId);
      setIsPaused(data.session.status === "PAUSED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái tạm dừng.");
    } finally {
      setIsUpdatingPause(false);
    }
  }

  async function handleSpeakQuestion() {
    await speakText(activeQuestionDisplay ?? "", { startListeningAfter: true });
  }

  async function handleCompleteInterview() {
    if (!completeTargetSessionId || isCompletingRef.current) {
      return;
    }

    isCompletingRef.current = true;
    setIsCompleting(true);
    setError("");
    setAutoSubmitCountdown(null);
    setLiveTranscript("");
    setInput("");
    setIsThinking(false);
    voiceRecorder.cancelRecording();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    try {
      await completeInterviewSession(completeTargetSessionId);
      sessionStorage.setItem(activeInterviewSessionStorageKey, completeTargetSessionId);
      router.push(`/interview/result?sessionId=${completeTargetSessionId}`);
    } catch (err) {
      isCompletingRef.current = false;
      setIsSubmitting(false);
      setIsThinking(false);
      setError(err instanceof Error ? err.message : t.completeFailed);
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleSkipQuestion() {
    if (!sessionId || isThinking || isSubmitting || isPaused || isCompletingRef.current) return;

    const question = questions[currentQuestion];
    setIsSubmitting(true);
    setError("");
    setInput("");
    setLiveTranscript("");
    setAutoSubmitCountdown(null);
    setLastFeedback(null);
    setLastSpeechMetrics(null);
    setLastPronunciation(null);
    setSpeechNotice("");
    voiceRecorder.cancelRecording();

    setMessagesList((current) => [
      ...current,
      {
        id: current.length + 1,
        author: "user",
        content: t.skipUserMessage,
        time: getClockTime()
      },
      {
        id: current.length + 2,
        author: "ai",
        content: t.skipAiMessage,
        time: getClockTime()
      }
    ]);

    try {
      const result = await skipInterviewQuestion({
        sessionId,
        sessionQuestionId: question.id
      });

      if (result.session.status === "COMPLETED") {
        sessionStorage.setItem(activeInterviewSessionStorageKey, sessionId);
        router.push(`/interview/result?sessionId=${sessionId}`);
        return;
      }

      await advanceToNextQuestion(result.session.answeredQuestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.skipFailed);
    } finally {
      setIsSubmitting(false);
      setIsThinking(false);
    }
  }

  function handleRetryQuestion() {
    voiceRecorder.cancelRecording();
    setInput("");
    setLiveTranscript("");
    setAutoSubmitCountdown(null);
    setError("");
    setLastFeedback(null);
    setLastSpeechMetrics(null);
    setLastPronunciation(null);
    setSpeechNotice("");
    if (interviewMode !== "TEXT") {
      window.setTimeout(() => {
        void speakText(activeQuestionDisplay, { startListeningAfter: true });
      }, 200);
    }
  }

  if (!mounted) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">{t.loadingShort}</div>;
  }

  return (
    <main id="main-content" className="min-h-screen bg-[#FDF8F5] text-[#2B231F] font-sans flex flex-col justify-between overflow-x-hidden p-4 md:p-6" tabIndex={-1} aria-label={t.title}>
      {/* Wave animation style tag */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes wave-bounce {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        .animate-wave-bar {
          animation: wave-bounce 1s ease-in-out infinite;
          transform-origin: bottom;
        }
      `}} />

      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-white/70 backdrop-blur-md border border-[#F0EBE7]/80 px-5 py-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#E8E3DF] text-[#2B231F] transition hover:bg-[#FDF8F5] shadow-sm" aria-label={t.backToDashboard}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-extrabold text-[#2B231F] leading-tight">Phòng phỏng vấn AI</h1>
            <p className="text-[10px] font-semibold text-[#8C837E] leading-tight">Phòng phỏng vấn trực tiếp với AI</p>
          </div>
        </div>

        {/* Pulse Dot + Timer Box */}
        <div className="flex items-center gap-2 bg-white border border-[#E8E3DF] shadow-sm px-4 py-2 rounded-full text-sm font-bold text-[#2B231F]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <span className="tabular-nums">{formatElapsed(elapsedSeconds)}</span>
          <span className="text-[#8C837E] font-medium">/ {plannedDurationMinutes === null ? '30:00' : `${plannedDurationMinutes.toString().padStart(2, "0")}:00`}</span>
          
          <button 
            type="button" 
            onClick={handleTogglePause} 
            disabled={isUpdatingPause} 
            className="ml-2.5 p-1 text-[#8C837E] hover:text-[#2B231F] hover:bg-[#FDF8F5] rounded-full transition"
            aria-label={isPaused ? t.resume : t.pause}
          >
            {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
          </button>
        </div>

        {/* Action Controls & Language */}
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={() => setShowChat((value) => !value)} 
            className="bg-white border border-[#E8E3DF] shadow-sm px-4 py-2 rounded-xl text-xs font-extrabold text-[#2B231F] flex items-center gap-1.5 hover:bg-[#FDF8F5] transition duration-200"
          >
            {showChat ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showChat ? "Ẩn chat" : "Hiện chat"}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#8C837E] hidden sm:inline">Ngôn ngữ</span>
            <select
              value={interviewLanguageMode}
              onChange={(event) => handleLanguageChange(event.target.value as InterviewLanguageMode)}
              className="bg-white border border-[#E8E3DF] shadow-sm rounded-xl px-3 py-2 text-xs font-extrabold text-[#2B231F] outline-none cursor-pointer hover:bg-[#FDF8F5] transition"
            >
              <option value="VI">Tiếng Việt</option>
              <option value="ZH">Tiếng Trung</option>
              <option value="EN">Tiếng Anh</option>
              <option value="BILINGUAL">Song ngữ</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left Column (Webcam stream, controls, general info) */}
        <section className={`flex flex-col min-h-0 gap-4 ${showChat ? "lg:col-span-8" : "lg:col-span-12"}`}>
          {/* Camera Feed Container */}
            <WebcamPreview
              activeSubtitle={activeSubtitle ?? undefined}
              isCameraOn={isCameraOn}
              metrics={visualMetrics}
              metricsStatus={visualMetricsStatus}
              onToggleCamera={toggleCamera}
              questionText={displayedQuestion || activeQuestion.questionText}
              videoRef={faceAnalysis.videoRef}
            />

          {/* Action Control Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 py-1">
            <button
              type="button"
              onClick={voiceRecorder.toggleRecording}
              disabled={interviewMode === "TEXT" || voiceRecorder.isTranscribing}
              className={`px-6 py-2.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition duration-200 shadow-sm border ${
                voiceRecorder.isRecording
                  ? 'bg-[#FDF2F2] border-[#FBD5D5] text-[#D92C3D]'
                  : 'bg-white border-[#E8E3DF] text-[#2B231F] hover:bg-[#FDF8F5]'
              }`}
            >
              <Mic size={16} />
              <span>{voiceRecorder.isRecording ? 'Tắt mic' : 'Bật mic'}</span>
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              disabled={isCameraBusy}
              className={`px-6 py-2.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition duration-200 shadow-sm border ${
                isCameraOn
                  ? 'bg-[#EBFDF2] border-[#D1F7E2] text-[#28A745]'
                  : 'bg-white border-[#E8E3DF] text-[#2B231F] hover:bg-[#FDF8F5]'
              }`}
            >
              <Video size={16} />
              <span>{cameraButtonLabel}</span>
            </button>

            <button
              type="button"
              onClick={handleCompleteInterview}
              disabled={!completeTargetSessionId || isCompleting}
              className="bg-[#D92C3D] hover:bg-[#B91F2F] text-white shadow-md shadow-red-500/10 px-8 py-2.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition duration-200 disabled:opacity-50"
            >
              <Phone size={15} className="mr-1" />
              <span>{isCompleting ? 'Đang gửi...' : 'Kết thúc'}</span>
            </button>

            <button
              type="button"
              onClick={handleSpeakQuestion}
              disabled={isSpeaking || !activeQuestionDisplay}
              className="px-4 py-2.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition duration-200 shadow-sm border border-[#E8E3DF] bg-white text-[#2B231F] hover:bg-[#FDF8F5] disabled:opacity-50"
            >
              <Volume2 size={16} />
              <span>{isSpeaking ? t.speaking : t.speakQuestion}</span>
            </button>

            <button
              type="button"
              onClick={handleRetryQuestion}
              disabled={isSubmitting || isPaused || isCompleting}
              className="px-4 py-2.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition duration-200 shadow-sm border border-[#E8E3DF] bg-white text-[#2B231F] hover:bg-[#FDF8F5] disabled:opacity-50"
            >
              <RotateCcw size={16} />
              <span>{t.retry}</span>
            </button>

            <button
              type="button"
              onClick={handleSkipQuestion}
              disabled={!sessionId || isThinking || isSubmitting || isPaused || isCompleting}
              className="px-4 py-2.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition duration-200 shadow-sm border border-[#E8E3DF] bg-white text-[#2B231F] hover:bg-[#FDF8F5] disabled:opacity-50"
            >
              <SkipForward size={16} />
              <span>{t.skip}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#F0EBE7] bg-white/80 p-3 shadow-sm md:grid-cols-[1fr_auto_auto] md:items-center">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F6F1EE] p-1 text-[11px] font-extrabold">
              {(["TEXT", "VOICE", "HYBRID"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setInterviewMode(mode)}
                  className={`min-h-9 rounded-lg px-2 transition ${interviewMode === mode ? "bg-white text-[#D92C3D] shadow-sm" : "text-[#8C837E] hover:text-[#2B231F]"}`}
                  aria-pressed={interviewMode === mode}
                >
                  {mode === "TEXT" ? t.textMode : mode === "VOICE" ? t.voiceMode : t.hybridMode}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-[11px] font-extrabold text-[#8C837E]">
              <span>{t.voiceLabel}</span>
              <select
                value={selectedVoicePreset}
                onChange={(event) => {
                  const next = event.target.value as SpeechVoicePreset;
                  setSelectedVoicePreset(next);
                  localStorage.setItem(speechVoiceStorageKey, next);
                }}
                className="rounded-xl border border-[#E8E3DF] bg-white px-3 py-2 text-xs font-extrabold text-[#2B231F] outline-none"
              >
                {voicePresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {getVoicePresetLabel(preset, t)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-[11px] font-extrabold text-[#8C837E]">
              <span>Tốc độ</span>
              <select
                value={selectedSpeechRate}
                onChange={(event) => {
                  const next = Number(event.target.value) as SpeechRate;
                  setSelectedSpeechRate(next);
                  localStorage.setItem(speechRateStorageKey, String(next));
                }}
                className="rounded-xl border border-[#E8E3DF] bg-white px-3 py-2 text-xs font-extrabold text-[#2B231F] outline-none"
              >
                {speechRates.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}x
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* System Check & Summary */}
          <div className="grid grid-cols-1 gap-4 mt-1 xl:grid-cols-[1fr_1.2fr]">
            <CameraCheckPanel checks={cameraChecks} />
            <VisualMetricsSummary metrics={visualMetrics} status={visualMetricsStatus} />
          </div>

          <section className="grid gap-3 md:grid-cols-3" aria-label={t.answerControls}>
            <div className="rounded-2xl border border-[#F0EBE7] bg-white p-4 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase text-[#8C837E]">{t.timer}</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-[#D92C3D]">{formatElapsed(elapsedSeconds)}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F6F1EE]" role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                <div className="h-full rounded-full bg-[#D92C3D]" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-[11px] font-bold text-[#8C837E]">{progressLabel}</p>
            </div>

            <div className="rounded-2xl border border-[#F0EBE7] bg-white p-4 shadow-sm" aria-live="polite">
              <p className="text-[10px] font-extrabold uppercase text-[#8C837E]">Thời lượng phỏng vấn</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-[#2B231F]">{formatDuration(plannedDurationMinutes)}</p>
              <p className={`mt-2 text-[11px] font-bold ${remainingSeconds === 0 ? "text-red-600" : "text-[#8C837E]"}`}>
                {remainingSeconds === null ? "Chưa đặt giới hạn" : `Còn ${formatElapsed(remainingSeconds)}`}
              </p>
            </div>

            <div className="rounded-2xl border border-[#D1F7E2] bg-[#F4FFF8] p-4 shadow-sm" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-extrabold uppercase text-[#246345]">{t.latestFeedback}</p>
                {lastFeedback?.scoreTotal ? <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-[#0a6b45]">{lastFeedback.scoreTotal}/10</span> : null}
              </div>
              <p className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-[#1f5138]">
                {lastFeedback?.feedback || t.noFeedbackYet}
              </p>
              {lastFeedback?.improvedAnswer ? (
                <details className="mt-2 text-xs font-bold text-[#246345]">
                  <summary className="cursor-pointer">{t.improvedAnswer}</summary>
                  <p className="mt-2 leading-5">{lastFeedback.improvedAnswer}</p>
                </details>
              ) : null}
            </div>
          </section>

          {(lastSpeechMetrics || lastPronunciation || isAssessingPronunciation || speechNotice) && (
            <section className="grid gap-4 xl:grid-cols-2" aria-live="polite">
              {lastSpeechMetrics ? <SpeechMetricsPanel metrics={lastSpeechMetrics} /> : null}
              {lastPronunciation ? <PronunciationPanel result={lastPronunciation} /> : null}
              {isAssessingPronunciation ? (
                <div className="rounded-2xl border border-[#F0EBE7] bg-white p-4 text-sm font-bold text-[#8C837E] shadow-sm">
                  Đang chấm phát âm...
                </div>
              ) : null}
              {speechNotice ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-700 shadow-sm">
                  {speechNotice}
                </div>
              ) : null}
            </section>
          )}
        </section>

        {/* Right Column (Chat & Realtime facial metrics) */}
        {showChat && (
          <section className="lg:col-span-4 flex flex-col min-h-0 gap-4">
            {/* Chat Room */}
            <div className="bg-white rounded-3xl border border-[#F0EBE7] shadow-sm flex flex-col overflow-hidden min-h-[380px] lg:h-[50%] flex-1">
              <div className="flex items-center justify-between border-b border-[#F0EBE7] px-4 py-3 bg-[#FCFBF9]">
                <div>
                  <h3 className="text-xs font-extrabold text-[#2B231F]">Hội thoại</h3>
                  <p className="text-[9px] text-[#8C837E] font-bold">AI Interviewer</p>
                </div>
                <button
                  type="button"
                  onClick={handleCompleteInterview}
                  disabled={!completeTargetSessionId || isCompleting}
                  className="bg-[#D92C3D] hover:bg-[#B91F2F] text-white px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition duration-200 shadow-sm"
                >
                  Kết thúc phỏng vấn
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0">
                {error && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700" role="alert">
                    {error}
                  </div>
                )}
                {messagesList.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))}
                {liveTranscript && (
                  <ChatBubble
                    message={{
                      author: "user",
                      content: liveTranscript,
                      id: -1,
                      time: getClockTime(),
                      translation: autoSubmitCountdown ? interpolate(t.sendingIn, { seconds: autoSubmitCountdown }) : t.listeningStatus
                    }}
                  />
                )}
                {autoSubmitCountdown && !liveTranscript && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700" role="status">
                    {interpolate(t.sendingIn, { seconds: autoSubmitCountdown })}
                  </div>
                )}
                {isThinking && (
                  <div className="rounded-xl border border-[#F0EBE7] bg-[#FCFBF9] p-3 text-xs font-extrabold text-[#8C837E] animate-pulse" role="status">
                    {t.thinking}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Text Input composer */}
              <form onSubmit={handleSubmit} className="p-3 border-t border-[#F0EBE7] bg-[#FCFBF9] flex items-center gap-2">
                <input
                  id="interview-answer"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={isLoadingSession || isSubmitting || isPaused || isUpdatingPause}
                  className="flex-1 bg-white border border-[#E8E3DF] rounded-full px-4.5 py-2 text-xs font-bold text-[#2B231F] placeholder:text-[#8C837E] outline-none shadow-inner"
                  placeholder={voiceRecorder.isRecording ? t.recordingPlaceholder : "Nhập tin nhắn hoặc bấm mic để nói..."}
                />
                <button
                  type="submit"
                  disabled={isLoadingSession || isSubmitting || isPaused || isUpdatingPause || !input.trim()}
                  className="h-8 w-8 rounded-full bg-[#D92C3D] hover:bg-[#B91F2F] text-white flex items-center justify-center transition duration-200 shadow disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  aria-label={t.sendAnswer}
                >
                  <Send size={14} />
                </button>
              </form>
            </div>

            {/* Realtime facial analysis panel */}
            <VisualMetricsPanel metrics={visualMetrics} status={visualMetricsStatus} />
          </section>
        )}
      </div>

      {/* Footer bar */}
      <footer className="flex flex-wrap items-center justify-between text-[10px] font-bold text-[#8C837E] border-t border-[#F0EBE7]/80 pt-4 mt-4 gap-3">
        <div className="flex flex-wrap items-center gap-4.5">
          <span className="flex items-center gap-1 text-[#28A745]">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="bg-[#EBFDF2] p-0.5 rounded-full border border-[#D1F7E2] stroke-[3px]">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>Kết nối ổn định</span>
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#8C837E]">
              <path d="m22 8-6 4 6 4V8Z" />
              <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
            </svg>
            <span>Camera: HD</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Mic size={12} className="text-[#8C837E]" />
            <span>Mic: {voiceRecorder.isRecording ? 'Đang bật' : 'Đang tắt'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#8C837E]">
              <rect width="16" height="16" x="4" y="4" rx="2" />
              <rect width="6" height="6" x="9" y="9" rx="1" />
              <path d="M9 1v3" />
              <path d="M15 1v3" />
              <path d="M9 20v3" />
              <path d="M15 20v3" />
              <path d="M20 9h3" />
              <path d="M20 15h3" />
              <path d="M1 9h3" />
              <path d="M1 15h3" />
            </svg>
            <span>AI: Đang hoạt động</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 cursor-pointer hover:text-[#2B231F] transition duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#8C837E]">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Bảo mật & quyền riêng tư</span>
        </div>
      </footer>
    </main>
  );
}

function mapQuestions(questions: InterviewQuestionDto[]): RoomQuestion[] {
  return questions.map(mapQuestion);
}

function mapQuestion(question: InterviewQuestionDto): RoomQuestion {
  return {
    aiReason: question.aiReason,
    category: question.category,
    difficulty: question.difficulty,
    expectedAnswerLogic: question.expectedAnswerLogic,
    id: question.id,
    language: question.language,
    questionText: question.questionText,
    source: question.source
  };
}

function getQuestionDisplayText(question: RoomQuestion, mode: InterviewLanguageMode) {
  if (mode === "VI" && question.language === "VI") return question.questionText;
  if (mode === "VI" && question.translation) return question.translation;
  return question.questionText;
}

function getQuestionSupportText(question: RoomQuestion) {
  return question.translation ?? question.expectedAnswerLogic ?? undefined;
}

function buildAiMessage(
  question: RoomQuestion,
  id: number,
  mode: InterviewLanguageMode,
  time = getClockTime(),
  prefix = ""
): ChatMessage {
  const isBilingual = mode === "BILINGUAL";
  const contentText = getQuestionDisplayText(question, mode);

  return {
    id,
    author: "ai",
    content: `${prefix}${contentText}`,
    translation: isBilingual ? getQuestionSupportText(question) : undefined,
    time
  };
}

function getClockTime() {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "Không giới hạn";
  if (minutes === 60) return "1 giờ";
  if (minutes % 60 === 0) return `${minutes / 60} giờ`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
  return `${minutes} phút`;
}

function getVoicePresetLabel(preset: SpeechVoicePreset, t: (typeof messages)["vi"]["interview"]) {
  const labels: Record<SpeechVoicePreset, string> = {
    auto: t.voiceAuto,
    clear: t.voiceClear,
    female: t.voiceFemale,
    male: t.voiceMale,
    slow: t.voiceSlow,
    warm: t.voiceWarm
  };
  return labels[preset];
}

function InterviewStatusRail({
  elapsedSeconds,
  lastFeedback,
  liveTranscript,
  plannedDurationMinutes,
  remainingSeconds,
  progress,
  progressLabel,
  t
}: {
  elapsedSeconds: number;
  lastFeedback: LastFeedback | null;
  liveTranscript: string;
  plannedDurationMinutes: number | null;
  remainingSeconds: number | null;
  progress: number;
  progressLabel: string;
  t: (typeof messages)["vi"]["interview"];
}) {
  return (
    <section className="mt-4 grid gap-3 md:grid-cols-3" aria-label={t.answerControls}>
      <div className="rounded-lg border border-border bg-background p-4">
        <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{t.timer}</p>
        <p className="mt-2 text-2xl font-black tabular-nums text-primary">{formatElapsed(elapsedSeconds)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs font-bold text-muted-foreground">{progressLabel}</p>
      </div>

      <div className="rounded-lg border border-border bg-background p-4" aria-live="polite">
        <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Thời lượng phỏng vấn</p>
        <p className="mt-2 text-2xl font-black tabular-nums text-primary">{formatDuration(plannedDurationMinutes)}</p>
        <p className={`mt-2 text-xs font-bold ${remainingSeconds === 0 ? "text-red-600" : "text-muted-foreground"}`}>
          {remainingSeconds === null ? "Chưa đặt giới hạn" : `Còn ${formatElapsed(remainingSeconds)}`}
        </p>
      </div>

      <div className="rounded-lg border border-[#cfe4d8] bg-[#f4fff8] p-4" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-wide text-[#246345]">{t.latestFeedback}</p>
          {lastFeedback?.scoreTotal ? <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-[#0a6b45]">{lastFeedback.scoreTotal}/10</span> : null}
        </div>
        <p className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-[#1f5138]">
          {lastFeedback?.feedback || t.noFeedbackYet}
        </p>
        {lastFeedback?.improvedAnswer ? (
          <details className="mt-2 text-xs font-bold text-[#246345]">
            <summary className="cursor-pointer">{t.improvedAnswer}</summary>
            <p className="mt-2 leading-5">{lastFeedback.improvedAnswer}</p>
          </details>
        ) : null}
      </div>
      {liveTranscript ? (
        <div className="rounded-lg border border-border bg-background p-4 md:col-span-3" aria-live="polite">
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{t.transcript}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-foreground">{liveTranscript}</p>
        </div>
      ) : null}
    </section>
  );
}

function InterviewHeader({
  elapsedSeconds,
  isPauseChanging,
  isPaused,
  plannedDurationMinutes,
  remainingSeconds,
  showChat,
  value,
  onChange,
  onToggleChat,
  onTogglePause,
  t
}: {
  elapsedSeconds: number;
  isPauseChanging: boolean;
  isPaused: boolean;
  plannedDurationMinutes: number | null;
  remainingSeconds: number | null;
  showChat: boolean;
  value: InterviewLanguageMode;
  onChange: (mode: InterviewLanguageMode) => void;
  onToggleChat: () => void;
  onTogglePause: () => void;
  t: (typeof messages)["vi"]["interview"];
}) {
  return (
    <header className="grid gap-4 border-b border-border bg-background px-5 py-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <Link href="/dashboard" className="focus-ring inline-flex min-h-11 items-center gap-3 text-lg font-black" aria-label={t.backToDashboard}>
        <span className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition hover:bg-muted">
          <ArrowLeft size={22} />
        </span>
        {t.title}
      </Link>

      <button type="button" onClick={onTogglePause} disabled={isPauseChanging} className="focus-ring inline-flex min-h-11 items-center justify-center gap-3 rounded-lg border border-border bg-background px-6 text-xl font-black tracking-wide shadow-sm transition hover:bg-muted disabled:opacity-50" aria-label={isPaused ? t.resume : t.pause}>
        <Timer size={18} />
        {formatElapsed(elapsedSeconds)}
        <span className="text-sm font-black text-muted-foreground">
          / {remainingSeconds === null ? formatDuration(plannedDurationMinutes) : formatElapsed((plannedDurationMinutes ?? 0) * 60)}
        </span>
        {isPaused ? <Play size={16} /> : <Pause size={16} />}
      </button>

      <div className="flex items-center justify-start gap-4 md:justify-end">
        <button type="button" onClick={onToggleChat} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-black shadow-sm transition hover:bg-muted" aria-pressed={showChat}>
          {showChat ? <EyeOff size={16} /> : <Eye size={16} />}
          {showChat ? "Ẩn chat" : "Hiện chat"}
        </button>
        <span className="text-sm font-black text-muted-foreground">{t.language}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as InterviewLanguageMode)}
          className="focus-ring inline-flex min-h-11 min-w-[150px] cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-black shadow-sm outline-none"
        >
          <option value="ZH">{t.languageZh}</option>
          <option value="VI">{t.languageVi}</option>
          <option value="EN">{t.languageEn}</option>
          <option value="BILINGUAL">{t.languageBilingual}</option>
        </select>
      </div>
    </header>
  );
}

function InterviewControls({
  interviewMode,
  isListening,
  isRecording,
  isSpeaking,
  isTranscribing,
  onModeChange,
  onToggleListening,
  onToggleRecording,
  t
}: {
  interviewMode: "TEXT" | "VOICE" | "HYBRID";
  isListening: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  isTranscribing: boolean;
  onModeChange: (mode: "TEXT" | "VOICE" | "HYBRID") => void;
  onToggleListening: () => void;
  onToggleRecording: () => void;
  t: (typeof messages)["vi"]["interview"];
}) {
  const modeLabels = {
    HYBRID: t.hybridMode,
    TEXT: t.textMode,
    VOICE: t.voiceMode
  };

  return (
    <div className="mx-auto mt-5 w-full max-w-[620px] rounded-lg border border-border bg-background px-4 py-3 shadow-sm">
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-muted p-1 text-xs font-black">
        {(["TEXT", "VOICE", "HYBRID"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange(mode)}
            className={`focus-ring min-h-11 rounded-lg px-3 py-2 transition ${interviewMode === mode ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
            aria-pressed={interviewMode === mode}
          >
            {modeLabels[mode]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3">
        <button type="button" onClick={onToggleRecording} disabled={interviewMode === "TEXT" || isTranscribing} className="focus-ring flex min-h-24 flex-col items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ${isRecording ? "bg-[#f3374d] shadow-red-500/25" : "bg-[#0a9f7a] shadow-emerald-500/25"}`}>
            {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={21} />}
          </span>
          {isTranscribing ? t.transcribing : isRecording ? t.stopRecording : t.micOn}
        </button>
        <button type="button" onClick={onToggleListening} disabled={isListening} className="focus-ring flex min-h-24 flex-col items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition hover:bg-muted disabled:cursor-wait disabled:opacity-70">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ${isListening ? "bg-[#d42027] shadow-red-500/25" : "bg-primary shadow-red-500/20"}`}>
            {isListening ? <Square size={18} fill="currentColor" /> : <Volume2 size={21} />}
          </span>
          {isListening ? t.speaking : t.speakQuestion}
        </button>
        <button type="button" onClick={() => onModeChange("TEXT")} disabled={isSpeaking} className="focus-ring flex min-h-24 flex-col items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary">
            <Keyboard size={22} />
          </span>
          {t.textMode}
        </button>
      </div>
    </div>
  );
}

function AnswerComposer({
  autoSubmitCountdown,
  input,
  isLoadingSession,
  isPaused,
  isRecording,
  isSubmitting,
  isUpdatingPause,
  onChange,
  onSubmit,
  t
}: {
  autoSubmitCountdown: number | null;
  input: string;
  isLoadingSession: boolean;
  isPaused: boolean;
  isRecording: boolean;
  isSubmitting: boolean;
  isUpdatingPause: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  t: (typeof messages)["vi"]["interview"];
}) {
  return (
    <form onSubmit={onSubmit} className="mt-4 border-t border-border bg-background/92 p-4" aria-label={t.answerLabel}>
      <p className="sr-only" id="answer-input-help">{t.answerInputHelp}</p>
      {autoSubmitCountdown ? (
        <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
          {interpolate(t.sendingIn, { seconds: autoSubmitCountdown })}
        </p>
      ) : null}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-sm">
        <label className="sr-only" htmlFor="interview-answer">{t.answerLabel}</label>
        <input
          id="interview-answer"
          value={input}
          onChange={(event) => onChange(event.target.value)}
          disabled={isLoadingSession || isSubmitting || isPaused || isUpdatingPause}
          aria-describedby="answer-input-help"
          className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
          placeholder={isRecording ? t.recordingPlaceholder : t.answerPlaceholder}
        />
        <button
          type="submit"
          disabled={isLoadingSession || isSubmitting || isPaused || isUpdatingPause}
          className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/15"
          aria-label={t.sendAnswer}
        >
          <Send size={19} />
        </button>
      </div>
    </form>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isAi = message.author === "ai";
  return (
    <div className={`flex gap-3 items-start ${isAi ? '' : 'flex-row-reverse animate-[fade-in_250ms_ease]'}`}>
      {isAi ? (
        <div className="h-8 w-8 shrink-0 rounded-full bg-[#D92C3D] flex items-center justify-center text-white text-[10px] font-extrabold shadow-sm select-none">
          AI
        </div>
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full bg-[#8C837E] flex items-center justify-center text-white text-[10px] font-extrabold shadow-sm select-none">
          ME
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[75%]">
        <div className={`rounded-2xl px-4 py-2.5 text-xs font-semibold shadow-sm leading-relaxed ${
          isAi 
            ? 'bg-[#FDF8F5] border border-[#F0EBE7] text-[#2B231F]' 
            : 'bg-[#D92C3D] text-white'
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.translation && (
            <p className={`mt-1 text-[10px] border-t pt-1 font-semibold leading-normal ${isAi ? 'border-[#E8E3DF] text-[#8C837E]' : 'border-white/20 text-white/80'}`}>
              {message.translation}
            </p>
          )}
        </div>
        <span className={`text-[8px] font-bold text-[#8C837E] px-1 ${isAi ? 'text-left' : 'text-right'}`}>{message.time}</span>
      </div>
    </div>
  );
}

function getVisualMetricsStatus(status: FaceAnalysisStatus, timestamp: number): VisualMetricsStatus {
  if (status === "error" || status === "unsupported") return "unavailable";
  if (status === "running" && timestamp > 0) return "live";
  return "neutral";
}

function mapVisualCheckToCameraStatus(check: VisualCheckState, status: FaceAnalysisStatus): CameraCheckStatus {
  if (status === "error" || status === "unsupported") return "unavailable";
  return check;
}

function inferSpeechLang(text: string, fallback: string) {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  if (/[\u00c0-\u1ef9]/i.test(text)) {
    return "vi-VN";
  }
  if (/[a-z]/i.test(text) && fallback === "zh-CN") return "vi-VN";
  return fallback;
}

function getBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
      return;
    }

    const timeout = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string) {
  const normalized = lang.toLowerCase();
  const base = normalized.split("-")[0];
  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalized) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${base}-`)) ??
    null
  );
}

function isSpeechVoicePreset(value: string | null): value is SpeechVoicePreset {
  return value === "auto" || value === "female" || value === "male" || value === "warm" || value === "slow" || value === "clear";
}

function isSpeechRate(value: number): value is SpeechRate {
  return speechRates.includes(value as SpeechRate);
}

function normalizeVoiceName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const femaleVoiceHints = [
  "female",
  "woman",
  "girl",
  "zira",
  "jenny",
  "aria",
  "sara",
  "susan",
  "victoria",
  "huihui",
  "xiaoxiao",
  "xiaoyi",
  "xiaomo",
  "xiaohan",
  "xiaorui",
  "xiaoqiu",
  "xiaorong",
  "xiaoxuan",
  "xiaoshuang",
  "xiaobei",
  "xiaoni",
  "yaoyao",
  "hanhan",
  "tingting",
  "tracy",
  "mei",
  "hoaimy",
  "hoai",
  "my",
  "linh",
  "mai"
];

const maleVoiceHints = [
  "boy",
  "david",
  "mark",
  "george",
  "daniel",
  "alex",
  "paul",
  "namminh",
  "nam minh",
  "kangkang",
  "yunjian",
  "yunxi",
  "yunyang",
  "yunhao",
  "yunze",
  "yunfeng"
];

const warmVoiceHints = ["natural", "premium", "online", "xiaoxiao", "zira", "jenny", "aria", "hoaimy", "linh", "mei"];

function getVoiceSearchKey(voice: SpeechSynthesisVoice) {
  return normalizeVoiceName(`${voice.name} ${voice.voiceURI}`);
}

function scorePresetVoice(voice: SpeechSynthesisVoice, wantedHints: string[], blockedHints: string[]) {
  const key = getVoiceSearchKey(voice);
  const wantedScore = wantedHints.reduce((score, hint) => score + (key.includes(hint) ? 4 : 0), 0);
  const blockedScore = blockedHints.reduce((score, hint) => score + (key.includes(hint) ? 8 : 0), 0);
  const naturalScore = key.includes("natural") || key.includes("online") ? 1 : 0;
  return wantedScore + naturalScore - blockedScore;
}

function pickPresetVoice(voices: SpeechSynthesisVoice[], lang: string, preset: SpeechVoicePreset) {
  const normalized = lang.toLowerCase();
  const base = normalized.split("-")[0];
  const languageVoices = voices.filter((voice) => {
    const voiceLang = voice.lang.toLowerCase();
    return voiceLang === normalized || voiceLang.startsWith(`${base}-`);
  });

  if (preset === "auto" || preset === "slow" || preset === "clear") return pickVoice(voices, lang);

  if (!languageVoices.length) return null;

  const wantedHints = preset === "female" ? femaleVoiceHints : preset === "male" ? maleVoiceHints : warmVoiceHints;
  const blockedHints = preset === "female" ? maleVoiceHints : preset === "male" ? femaleVoiceHints : [];

  const scored = languageVoices
    .map((voice) => {
      return { score: scorePresetVoice(voice, wantedHints, blockedHints), voice };
    })
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].voice;

  return preset === "warm" ? pickVoice(languageVoices, lang) : null;
}

function getPresetRate(lang: string, preset: SpeechVoicePreset, speechRate: SpeechRate = 1) {
  const baseRate = (() => {
    if (preset === "slow") return lang === "zh-CN" ? 0.92 : 0.95;
    if (preset === "clear") return lang === "zh-CN" ? 1.06 : 1.08;
    if (preset === "warm") return lang === "zh-CN" ? 0.98 : 1;
    return lang === "zh-CN" ? 1.02 : 1.04;
  })();
  return Math.min(1.8, Math.max(0.45, baseRate * speechRate));
}

function getPresetPitch(preset: SpeechVoicePreset) {
  if (preset === "female") return 1.06;
  if (preset === "male") return 0.94;
  if (preset === "warm") return 0.96;
  return 1;
}

function shouldPreferRemoteSpeech(preset: SpeechVoicePreset) {
  return preset !== "auto";
}

function getRemoteSpeechPreset(preset: SpeechVoicePreset, lang: string, speechRate: SpeechRate): { voice: RemoteSpeechVoice; speed: number } {
  const speed = getPresetRate(lang, preset, speechRate);
  if (preset === "male") return { voice: "onyx", speed };
  if (preset === "warm") return { voice: "shimmer", speed };
  if (preset === "clear") return { voice: "shimmer", speed };
  return { voice: "nova", speed };
}

async function speakWithBrowser(text: string, lang: string, errorMessage: string, preset: SpeechVoicePreset = "auto", speechRate: SpeechRate = 1) {
  const voices = await getBrowserVoices();
  const voice = pickPresetVoice(voices, lang, preset);

  if (!voice) {
    const presetLabel = preset === "female" ? "n\u1eef" : preset === "male" ? "nam" : "ph\u00f9 h\u1ee3p";
    throw new MissingBrowserVoiceError(`M\u00e1y ch\u01b0a c\u00f3 gi\u1ecdng ${presetLabel} cho ${lang}.`);
  }

  return new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? lang;
    utterance.rate = getPresetRate(lang, preset, speechRate);
    utterance.pitch = getPresetPitch(preset);
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error(errorMessage));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}
