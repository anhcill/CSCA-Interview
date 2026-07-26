"use client";

import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Mic,
  Pause,
  Phone,
  Play,
  RotateCcw,
  Send,
  SkipForward,
  Video,
  Volume2,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { PageLoadingState } from "@/components/ui/page-state";
import {
  activeInterviewSessionStorageKey,
  completeInterviewSession,
  createInterviewSession,
  fetchInterviewQuestionAudio,
  fetchInterviewSession,
  fetchNextInterviewQuestion,
  pauseInterviewSession,
  resumeInterviewSession,
  skipInterviewQuestion,
  submitInterviewAnswer,
} from "@/lib/interview-client";
import {
  backendLanguageToBrowserSpeechLang,
  backendLanguageToSpeechLocale,
  getStoredInterviewLanguageMode,
  getStoredLocale,
  interpolate,
  interviewModeToBackendLanguage,
  languageModeLabel,
  localeChangedEvent,
  messages,
  setStoredInterviewLanguageMode,
  type BackendLanguage,
  type InterviewLanguageMode,
  type Locale
} from "@/lib/i18n";
import { type VoiceRecorderResult, useVoiceRecorder } from "@/lib/hooks/use-voice-recorder";
import { getVoiceRecorderStateLabel } from "@/lib/hooks/voice-recorder-machine";
import { useFaceAnalysis } from "@/lib/hooks/use-face-analysis";
import { assessPronunciation, playBase64Audio, stopActiveSpeechAudio, synthesizeSpeech, type PronunciationResult, type SpeechMetrics } from "@/lib/speech-client";
import { CameraCheckPanel, type CameraSystemChecks } from "./camera-check-panel";
import { ChatBubble } from "./chat-bubble";
import type { ChatMessage } from "./interview-data";
import { getInterviewPhasePresentation } from "./interview-phase";
import { playAudioUrl, stopQuestionAudio } from "./question-audio-player";
import {
  buildAiMessage,
  fallbackQuestions,
  formatDuration,
  formatElapsed,
  getClockTime,
  getQuestionDisplayText,
  getQuestionSupportText,
  mapQuestion,
  mapQuestions,
  type RoomQuestion
} from "./question-flow";
import { PronunciationPanel, SpeechMetricsPanel } from "./speech-metrics-panel";
import {
  getRemoteSpeechPreset,
  getVoicePresetLabel,
  inferSpeechLang,
  isQuestionReaderMode,
  isSpeechRate,
  isSpeechVoicePreset,
  MissingBrowserVoiceError,
  questionReaderStorageKey,
  shouldPreferRemoteSpeech,
  speechRateStorageKey,
  speechRates,
  speechVoiceStorageKey,
  speakWithBrowser,
  type QuestionReaderMode,
  type SpeechRate,
  type SpeechVoicePreset,
  voicePresets
} from "./speech-settings";
import { getVisualMetricsStatus, mapVisualCheckToCameraStatus } from "./visual-status";
import { VisualMetricsPanel, VisualMetricsSummary } from "./visual-metrics-panel";
import { WebcamPreview } from "./webcam-preview";

type LastFeedback = {
  feedback: string | null;
  improvedAnswer: string | null;
  scoreTotal: string | null;
};

type SpeechSubmitPayload = {
  pronunciation?: PronunciationResult | null;
  result?: VoiceRecorderResult;
};

const maxNoSpeechAutoRetries = 0;
const autoSendVoiceAnswerStorageKey = "ai_phongvan_auto_send_voice_answer";

export function InterviewRoom() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const [locale, setLocale] = useState<Locale>("vi");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLanguage, setSessionLanguage] = useState<BackendLanguage>("ZH");
  const [interviewLanguageMode, setInterviewLanguageMode] = useState<InterviewLanguageMode>("ZH");
  const [plannedDurationMinutes, setPlannedDurationMinutes] = useState<number | null>(null);
  const [plannedQuestionCount, setPlannedQuestionCount] = useState(fallbackQuestions.length);
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
  const [noSpeechSignal, setNoSpeechSignal] = useState(0);
  const [selectedVoicePreset, setSelectedVoicePreset] = useState<SpeechVoicePreset>("auto");
  const [selectedSpeechRate, setSelectedSpeechRate] = useState<SpeechRate>(1);
  const [selectedQuestionReader, setSelectedQuestionReader] = useState<QuestionReaderMode>("ai");
  const [showChat, setShowChat] = useState(true);
  const [pendingVoiceResult, setPendingVoiceResult] = useState<VoiceRecorderResult | null>(null);
  const [autoSendVoiceAnswer, setAutoSendVoiceAnswer] = useState(false);

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
  const hasAutoCompletedForTimeRef = useRef(false);
  const lastAutoSpokenQuestionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const noSpeechRetryTimerRef = useRef<number | null>(null);
  const noSpeechRetryCountRef = useRef(0);
  const autoSendTimeoutRef = useRef<number | null>(null);
  const autoSendIntervalRef = useRef<number | null>(null);
  const continueTranscriptBaseRef = useRef("");
  const submissionIdRef = useRef<string | null>(null);
  const submissionInFlightRef = useRef(false);
  const startRecordingRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const recorderStateRef = useRef({ isRecording: false, isTranscribing: false });
  const interviewModeRef = useRef(interviewMode);
  const isPausedRef = useRef(isPaused);
  const t = messages[locale].interview;
  const isBilingual = interviewLanguageMode === "BILINGUAL";

  const handleRecorderNoSpeech = useCallback(() => {
    setNoSpeechSignal((value) => value + 1);
  }, []);

  const clearAutoSendTimer = useCallback(() => {
    if (autoSendTimeoutRef.current !== null) window.clearTimeout(autoSendTimeoutRef.current);
    if (autoSendIntervalRef.current !== null) window.clearInterval(autoSendIntervalRef.current);
    autoSendTimeoutRef.current = null;
    autoSendIntervalRef.current = null;
    setAutoSubmitCountdown(null);
  }, []);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(speechVoiceStorageKey);
    if (isSpeechVoicePreset(stored)) setSelectedVoicePreset(stored);
    const storedRate = Number(localStorage.getItem(speechRateStorageKey));
    if (isSpeechRate(storedRate)) setSelectedSpeechRate(storedRate);
    const storedReader = localStorage.getItem(questionReaderStorageKey);
    if (isQuestionReaderMode(storedReader)) setSelectedQuestionReader(storedReader);
    setAutoSendVoiceAnswer(localStorage.getItem(autoSendVoiceAnswerStorageKey) === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.getVoices();
  }, []);

  const voiceRecorder = useVoiceRecorder({
    language: backendLanguageToSpeechLocale(sessionLanguage),
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
    onNoSpeech: handleRecorderNoSpeech,
    onTranscript: (text, result) => {
      const transcript = text.trim();
      if (!transcript) return;
      clearAutoSendTimer();
      setLiveTranscript("");
      const combinedTranscript = [continueTranscriptBaseRef.current, transcript]
        .filter(Boolean)
        .join(" ")
        .trim();
      continueTranscriptBaseRef.current = "";
      setInput(combinedTranscript);
      setSpeechNotice("");
      setPendingVoiceResult(result ?? null);
      if (result?.speechMetrics) setLastSpeechMetrics(result.speechMetrics);
    }
  });

  useEffect(() => {
    if (
      !autoSendVoiceAnswer
      || !pendingVoiceResult
      || voiceRecorder.state !== "REVIEW"
      || !input.trim()
    ) {
      clearAutoSendTimer();
      return;
    }

    const startedAt = Date.now();
    setAutoSubmitCountdown(5);
    autoSendIntervalRef.current = window.setInterval(() => {
      const remaining = Math.max(0, 5000 - (Date.now() - startedAt));
      setAutoSubmitCountdown(remaining > 0 ? Math.ceil(remaining / 1000) : null);
    }, 250);
    autoSendTimeoutRef.current = window.setTimeout(() => {
      clearAutoSendTimer();
      void submitAnswer(input, pendingVoiceResult);
    }, 5000);

    return clearAutoSendTimer;
  }, [autoSendVoiceAnswer, input, pendingVoiceResult, voiceRecorder.state, clearAutoSendTimer]);

  const clearNoSpeechRetryTimer = useCallback(() => {
    if (noSpeechRetryTimerRef.current !== null) {
      window.clearTimeout(noSpeechRetryTimerRef.current);
      noSpeechRetryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    interviewModeRef.current = interviewMode;
    isPausedRef.current = isPaused;
    recorderStateRef.current = {
      isRecording: voiceRecorder.isRecording,
      isTranscribing: voiceRecorder.isTranscribing
    };
    startRecordingRef.current = voiceRecorder.startRecording;
  }, [interviewMode, isPaused, voiceRecorder.isRecording, voiceRecorder.isTranscribing, voiceRecorder.startRecording]);

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
  const totalQuestions = Math.max(plannedQuestionCount, questions.length);
  const plannedDurationSeconds = plannedDurationMinutes ? plannedDurationMinutes * 60 : null;
  const remainingSeconds = plannedDurationSeconds === null ? null : Math.max(0, plannedDurationSeconds - elapsedSeconds);
  const progress = useMemo(() => ((currentQuestion + 1) / totalQuestions) * 100, [currentQuestion, totalQuestions]);
  const progressLabel = interpolate(t.questionProgress, { current: currentQuestion + 1, total: totalQuestions });
  const activePhase = getInterviewPhasePresentation(activeQuestion.category);
  const isIntroductionPhase = activeQuestion.orderIndex === 1 && activeQuestion.category === "PERSONAL";
  const introductionRemainingSeconds = Math.max(0, 5 * 60 - elapsedSeconds);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [error, isThinking, liveTranscript, messagesList]);

  useEffect(() => {
    noSpeechRetryCountRef.current = 0;
    clearNoSpeechRetryTimer();
    clearAutoSendTimer();
    setPendingVoiceResult(null);
    continueTranscriptBaseRef.current = "";
    submissionIdRef.current = null;
    voiceRecorder.cancelRecording();
  }, [activeQuestion.id]);

  useEffect(() => {
    if (noSpeechSignal === 0) return;

    setAutoSubmitCountdown(null);
    setLiveTranscript("");

    if (interviewModeRef.current === "TEXT" || isPausedRef.current || isCompletingRef.current) {
      setSpeechNotice("Chưa nghe rõ câu trả lời. Bạn có thể nhập câu trả lời bằng bàn phím.");
      return;
    }

    const nextAttempt = noSpeechRetryCountRef.current + 1;
    noSpeechRetryCountRef.current = nextAttempt;

    if (nextAttempt > maxNoSpeechAutoRetries) {
      setSpeechNotice("Chưa nghe rõ câu trả lời. Bạn có thể bấm Bật mic hoặc Trả lời lại câu hỏi để thử lại.");
      return;
    }

    setSpeechNotice(`Chưa nghe rõ câu trả lời. Hệ thống sẽ mở lại mic lần ${nextAttempt}/${maxNoSpeechAutoRetries}.`);
    clearNoSpeechRetryTimer();
    noSpeechRetryTimerRef.current = window.setTimeout(() => {
      const recorderState = recorderStateRef.current;
      if (
        !isCompletingRef.current &&
        !isPausedRef.current &&
        interviewModeRef.current !== "TEXT" &&
        !recorderState.isRecording &&
        !recorderState.isTranscribing
      ) {
        void startRecordingRef.current();
      }
    }, 900);
  }, [clearNoSpeechRetryTimer, noSpeechSignal]);

  useEffect(() => {
    return () => {
      clearNoSpeechRetryTimer();
      clearAutoSendTimer();
    };
  }, [clearAutoSendTimer, clearNoSpeechRetryTimer]);

  const startListeningAfterSpeech = useCallback((shouldStart?: boolean) => {
    if (!isCompletingRef.current && shouldStart && interviewMode !== "TEXT" && !isPausedRef.current && !voiceRecorder.isRecording && !voiceRecorder.isTranscribing) {
      window.setTimeout(() => {
        if (!isCompletingRef.current && !isPausedRef.current) void voiceRecorder.startRecording();
      }, 250);
    }
  }, [interviewMode, voiceRecorder]);

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
      startListeningAfterSpeech(options.startListeningAfter);
    }
  }, [
    isSpeaking,
    sessionLanguage,
    selectedVoicePreset,
    selectedSpeechRate,
    startListeningAfterSpeech,
    t.browserSpeechFailed,
    t.speechFailed
  ]);

  const speakQuestion = useCallback(async (question: RoomQuestion, options: { startListeningAfter?: boolean } = {}) => {
    clearAutoSendTimer();
    voiceRecorder.cancelRecording();
    stopActiveSpeechAudio();
    stopQuestionAudio();
    const text = getQuestionDisplayText(question, interviewLanguageMode);

    if (selectedQuestionReader !== "human" || !sessionId || question.id.startsWith("fallback-")) {
      await speakText(text, options);
      return;
    }

    if (!text || isSpeaking) return;

    setIsSpeaking(true);
    setError("");
    setSpeechNotice("");

    let playedHumanAudio = false;

    try {
      const audio = await fetchInterviewQuestionAudio(sessionId, question.id);

      if (audio.audioUrl) {
        await playAudioUrl(audio.audioUrl);
        playedHumanAudio = true;
      } else {
        setSpeechNotice("Chưa có bản đọc người thật cho câu này, hệ thống sẽ dùng giọng AI.");
      }
    } catch {
      setSpeechNotice("Không tải được bản đọc người thật, hệ thống sẽ dùng giọng AI.");
    } finally {
      setIsSpeaking(false);
    }

    if (playedHumanAudio) {
      startListeningAfterSpeech(options.startListeningAfter);
      return;
    }

    await speakText(text, options);
  }, [
    interviewLanguageMode,
    isSpeaking,
    clearAutoSendTimer,
    selectedQuestionReader,
    sessionId,
    speakText,
    startListeningAfterSpeech,
    voiceRecorder.cancelRecording
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
        void speakQuestion(activeQuestion, { startListeningAfter: true });
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    activeQuestion,
    activeQuestion.id,
    activeQuestionDisplay,
    interviewMode,
    isLoadingSession,
    isPaused,
    prefersReducedMotion,
    sessionLanguage,
    speakQuestion
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
        const targetSessionId = querySessionId || storedSessionId;
        const initialMode: InterviewLanguageMode = wantsBilingual
          ? "BILINGUAL"
          : targetSessionId
            ? storedMode
            : "ZH";
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
        setPlannedQuestionCount(Math.max(data.session.totalQuestions, loadedQuestions.length));
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
    if (!answer || !sessionId || submissionInFlightRef.current || isPaused || isCompletingRef.current) {
      return;
    }
    submissionInFlightRef.current = true;

    const question = questions[currentQuestion];
    const submissionId = submissionIdRef.current ?? crypto.randomUUID();
    submissionIdRef.current = submissionId;
    clearAutoSendTimer();
    clearNoSpeechRetryTimer();
    noSpeechRetryCountRef.current = 0;

    setIsSubmitting(true);
    voiceRecorder.markSubmitting();
    setError("");
    setInput("");
    setLiveTranscript("");
    clearAutoSendTimer();
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
        submissionId,
        speechDurationSec: speechPayload.result?.duration ?? speechPayload.result?.speechMetrics?.durationSec ?? null,
        speechLanguage: speechPayload.result?.language ?? null,
        speechMetrics: speechPayload.result?.speechMetrics ?? null,
        speechMimeType: speechPayload.result?.mimeType ?? null,
        speechTranscript: speechPayload.result?.text ?? null
      });

      if (isCompletingRef.current) return;

      setLastFeedback({
        feedback: "Đã lưu câu trả lời. AI sẽ chấm điểm sau khi bạn hoàn thành tất cả câu hỏi.",
        improvedAnswer: null,
        scoreTotal: null
      });

      setInput("");
      setPendingVoiceResult(null);
      continueTranscriptBaseRef.current = "";
      submissionIdRef.current = null;
      voiceRecorder.markIdle();

      if (result.session.status === "COMPLETED") {
        sessionStorage.setItem(activeInterviewSessionStorageKey, sessionId);
        router.push(`/interview/result?sessionId=${sessionId}`);
        return;
      }

      await advanceToNextQuestion(result.session.answeredQuestions);
    } catch (err) {
      if (isCompletingRef.current) return;
      setError(err instanceof Error ? err.message : t.saveFailed);
      voiceRecorder.markReview();
    } finally {
      submissionInFlightRef.current = false;
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
      if (nextResult.plannedTotalQuestions) {
        setPlannedQuestionCount((current) => Math.max(current, nextResult.plannedTotalQuestions ?? 0));
      }

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
          void speakQuestion(nextRoomQuestion, { startListeningAfter: true });
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
    await submitAnswer(input, pendingVoiceResult ?? undefined);
  }

  function handleToggleMicrophone() {
    clearAutoSendTimer();
    stopActiveSpeechAudio();
    stopQuestionAudio();
    if (!voiceRecorder.isRecording && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    voiceRecorder.toggleRecording();
  }

  function handleContinueSpeaking() {
    clearAutoSendTimer();
    continueTranscriptBaseRef.current = input.trim();
    setPendingVoiceResult(null);
    setLiveTranscript("");
    void voiceRecorder.startRecording();
  }

  function handleRetakeAnswer() {
    clearAutoSendTimer();
    continueTranscriptBaseRef.current = "";
    setInput("");
    setLiveTranscript("");
    setPendingVoiceResult(null);
    setError("");
    voiceRecorder.cancelRecording();
    window.setTimeout(() => void voiceRecorder.startRecording(), 100);
  }

  async function handleRetryTranscription() {
    clearAutoSendTimer();
    setError("");
    const retried = await voiceRecorder.retryTranscription();
    if (!retried) {
      setSpeechNotice("Không thể nhận dạng lại bản ghi. Bạn có thể thu lại hoặc nhập câu trả lời bằng bàn phím.");
    }
  }

  async function handleTogglePause() {
    if (!sessionId || isUpdatingPause || isCompletingRef.current) return;

    const nextPaused = !isPaused;
    setIsUpdatingPause(true);
    setError("");

    if (nextPaused) {
      isPausedRef.current = true;
      clearNoSpeechRetryTimer();
      clearAutoSendTimer();
      setLiveTranscript("");
      voiceRecorder.cancelRecording();
      stopActiveSpeechAudio();
      stopQuestionAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }

    try {
      const data = nextPaused
        ? await pauseInterviewSession(sessionId)
        : await resumeInterviewSession(sessionId);
      setIsPaused(data.session.status === "PAUSED");
      isPausedRef.current = data.session.status === "PAUSED";
    } catch (err) {
      isPausedRef.current = isPaused;
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái tạm dừng.");
    } finally {
      setIsUpdatingPause(false);
    }
  }

  async function handleSpeakQuestion() {
    await speakQuestion(activeQuestion, { startListeningAfter: true });
  }

  const handleCompleteInterview = useCallback(async () => {
    if (!completeTargetSessionId || isCompletingRef.current) {
      return;
    }

    isCompletingRef.current = true;
    setIsCompleting(true);
    clearNoSpeechRetryTimer();
    clearAutoSendTimer();
    setError("");
    setLiveTranscript("");
    setInput("");
    setIsThinking(false);
    voiceRecorder.cancelRecording();
    stopActiveSpeechAudio();
    stopQuestionAudio();
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
  }, [clearAutoSendTimer, clearNoSpeechRetryTimer, completeTargetSessionId, router, t.completeFailed, voiceRecorder.cancelRecording]);

  useEffect(() => {
    hasAutoCompletedForTimeRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (
      plannedDurationSeconds === null ||
      isLoadingSession ||
      isPaused ||
      !completeTargetSessionId ||
      isCompletingRef.current ||
      hasAutoCompletedForTimeRef.current ||
      elapsedSeconds < plannedDurationSeconds
    ) {
      return;
    }

    hasAutoCompletedForTimeRef.current = true;
    setSpeechNotice("Đã hết thời lượng phỏng vấn, hệ thống đang tổng hợp và chấm điểm.");
    void handleCompleteInterview();
  }, [completeTargetSessionId, elapsedSeconds, handleCompleteInterview, isLoadingSession, isPaused, plannedDurationSeconds]);

  async function handleSkipQuestion() {
    if (!sessionId || isThinking || isSubmitting || isPaused || isCompletingRef.current) return;

    const question = questions[currentQuestion];
    setIsSubmitting(true);
    setError("");
    setInput("");
    setLiveTranscript("");
    clearAutoSendTimer();
    setLastFeedback(null);
    setLastSpeechMetrics(null);
    setLastPronunciation(null);
    setSpeechNotice("");
    clearNoSpeechRetryTimer();
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
    clearAutoSendTimer();
    voiceRecorder.cancelRecording();
    setInput("");
    setLiveTranscript("");
    setError("");
    setLastFeedback(null);
    setLastSpeechMetrics(null);
    setLastPronunciation(null);
    setSpeechNotice("");
    clearNoSpeechRetryTimer();
    noSpeechRetryCountRef.current = 0;
    if (interviewMode !== "TEXT") {
      window.setTimeout(() => {
        void speakQuestion(activeQuestion, { startListeningAfter: true });
      }, 200);
    }
  }

  if (!mounted) {
    return <PageLoadingState description="Đang kết nối và chuẩn bị phòng phỏng vấn của bạn." />;
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
          {isIntroductionPhase ? (
            <span className="ml-2 rounded-full bg-[#FFF1D6] px-2 py-1 text-[11px] text-[#8A5A00]">
              Giới thiệu 5 phút · còn {formatElapsed(introductionRemainingSeconds)}
            </span>
          ) : (
            <span className="ml-2 rounded-full bg-[#F4EFFF] px-2 py-1 text-[11px] text-[#6546A8]">
              {activePhase.label} · {activePhase.targetMinutes} phút
            </span>
          )}
          
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
            <span
              className="bg-white border border-[#E8E3DF] shadow-sm rounded-xl px-3 py-2 text-xs font-extrabold text-[#2B231F]"
              title="Ngôn ngữ được khóa theo lựa chọn khi tạo buổi phỏng vấn"
            >
              {languageModeLabel(interviewLanguageMode, locale)}
            </span>
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
              onToggleCamera={toggleCamera}
              questionText={displayedQuestion || activeQuestion.questionText}
              videoRef={faceAnalysis.videoRef}
            />

          {/* Action Control Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 py-1">
            <button
              type="button"
              onClick={handleToggleMicrophone}
              disabled={interviewMode === "TEXT" || voiceRecorder.isTranscribing}
              aria-label={voiceRecorder.isRecording ? "Tắt micro" : "Bật micro"}
              aria-pressed={voiceRecorder.isRecording}
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

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-[#8C837E]" aria-live="polite">
            <span className="rounded-full border border-[#E8E3DF] bg-white px-3 py-1.5">
              {getVoiceRecorderStateLabel(voiceRecorder.state)}
            </span>
            {voiceRecorder.state === "WAITING_FOR_MORE" ? (
              <span>Bạn có thể tiếp tục nói; mic chỉ dừng sau khoảng 5 giây im lặng.</span>
            ) : null}
          </div>

          {voiceRecorder.state === "REVIEW" ? (
            <section className="rounded-2xl border border-[#E5D8FF] bg-[#FAF7FF] p-4 shadow-sm" aria-label="Xác nhận câu trả lời bằng giọng nói">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[#3F2A72]">Kiểm tra câu trả lời trước khi gửi</p>
                  <p className="mt-1 text-xs font-semibold text-[#77689A]">
                    Bạn có thể sửa nội dung trong ô chat, nói tiếp hoặc thu lại.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#6546A8]">
                  <input
                    type="checkbox"
                    checked={autoSendVoiceAnswer}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setAutoSendVoiceAnswer(enabled);
                      localStorage.setItem(autoSendVoiceAnswerStorageKey, enabled ? "1" : "0");
                      if (!enabled) clearAutoSendTimer();
                    }}
                    className="h-4 w-4 accent-[#6546A8]"
                  />
                  Tự gửi sau 5 giây
                </label>
              </div>

              <div className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[#E5D8FF] bg-white p-3 text-sm font-semibold leading-6 text-[#2B231F]">
                {input.trim() || "Chưa nhận dạng được nội dung. Hãy thử nhận dạng lại, thu lại hoặc nhập bằng bàn phím."}
              </div>

              {autoSubmitCountdown ? (
                <p className="mt-2 text-xs font-bold text-[#8A5A00]">
                  Tự gửi sau {autoSubmitCountdown} giây. Bỏ chọn để hủy.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void submitAnswer(input, pendingVoiceResult ?? undefined)}
                  disabled={!input.trim() || isSubmitting}
                  className="rounded-xl bg-[#D92C3D] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-40"
                >
                  Gửi câu trả lời
                </button>
                <button
                  type="button"
                  onClick={handleContinueSpeaking}
                  disabled={isSubmitting}
                  className="rounded-xl border border-[#D8C8FA] bg-white px-4 py-2 text-xs font-extrabold text-[#6546A8]"
                >
                  Tiếp tục nói
                </button>
                <button
                  type="button"
                  onClick={handleRetakeAnswer}
                  disabled={isSubmitting}
                  className="rounded-xl border border-[#E8E3DF] bg-white px-4 py-2 text-xs font-extrabold text-[#2B231F]"
                >
                  Thu lại
                </button>
                {!pendingVoiceResult ? (
                  <button
                    type="button"
                    onClick={() => void handleRetryTranscription()}
                    disabled={isSubmitting || voiceRecorder.isTranscribing}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-extrabold text-amber-700"
                  >
                    Nhận dạng lại
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#F0EBE7] bg-white/80 p-3 shadow-sm md:grid-cols-[1fr_auto_auto_auto] md:items-center">
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
              <span>Nguồn đọc</span>
              <select
                value={selectedQuestionReader}
                onChange={(event) => {
                  const next = event.target.value as QuestionReaderMode;
                  setSelectedQuestionReader(next);
                  localStorage.setItem(questionReaderStorageKey, next);
                }}
                className="rounded-xl border border-[#E8E3DF] bg-white px-3 py-2 text-xs font-extrabold text-[#2B231F] outline-none"
              >
                <option value="ai">AI hệ thống</option>
                <option value="human">Người thật</option>
              </select>
            </label>

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
              <p className="mt-1 text-[11px] font-extrabold text-[#6546A8]">
                Giai đoạn: {activePhase.label}
              </p>
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
            <span>
              AI: {isThinking
                ? "Đang tạo câu hỏi đào sâu"
                : isSubmitting
                  ? "Đang chấm câu trả lời"
                  : isCompleting
                    ? "Đang hoàn tất báo cáo"
                    : "Sẵn sàng"}
            </span>
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
