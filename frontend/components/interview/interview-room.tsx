"use client";

import { useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Keyboard,
  Lightbulb,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Send,
  SkipForward,
  Square,
  Timer,
  Volume2
} from "lucide-react";
import { ApiError, type EventStreamHandle } from "@/lib/api";
import {
  activeInterviewSessionStorageKey,
  completeInterviewSession,
  createInterviewSession,
  fetchInterviewSession,
  fetchNextInterviewQuestion,
  pauseInterviewSession,
  resumeInterviewSession,
  skipInterviewQuestion,
  streamInterviewAnswerFeedback,
  type InterviewQuestionDto,
  type SubmitInterviewAnswerResponse
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
import { useVoiceRecorder } from "@/lib/hooks/use-voice-recorder";
import { playBase64Audio, synthesizeSpeech } from "@/lib/speech-client";
import { ChatMessage, interviewQuestions } from "./interview-data";

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
const completingInterviewSignal = "__INTERVIEW_COMPLETING__";
type SpeechVoicePreset = "auto" | "female" | "male" | "warm" | "slow" | "clear";
type RemoteSpeechVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
type LastFeedback = {
  feedback: string | null;
  improvedAnswer: string | null;
  scoreTotal: string | null;
};

const voicePresets: SpeechVoicePreset[] = ["auto", "female", "male", "warm", "slow", "clear"];

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
  const [showHint, setShowHint] = useState(false);
  const [displayedQuestion, setDisplayedQuestion] = useState("");
  const [error, setError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState<LastFeedback | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedVoicePreset, setSelectedVoicePreset] = useState<SpeechVoicePreset>("auto");
  const isCompletingRef = useRef(false);
  const feedbackStreamRef = useRef<EventStreamHandle | null>(null);
  const cancelFeedbackStreamRef = useRef<(() => void) | null>(null);
  const lastAutoSpokenQuestionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const t = messages[locale].interview;
  const isBilingual = interviewLanguageMode === "BILINGUAL";

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(speechVoiceStorageKey);
    if (isSpeechVoicePreset(stored)) setSelectedVoicePreset(stored);
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
    onTranscript: (text) => {
      const transcript = text.trim();
      if (!transcript) return;
      setAutoSubmitCountdown(null);
      setLiveTranscript("");
      setInput(transcript);
      if (interviewMode !== "TEXT") {
        void submitAnswer(transcript);
      }
    }
  });

  const totalQuestions = questions.length;
  const activeQuestion = questions[currentQuestion] ?? fallbackQuestions[0];
  const activeSubtitle = isBilingual ? getQuestionSupportText(activeQuestion) : null;
  const completeTargetSessionId = sessionId ?? searchParams.get("sessionId");
  const activeQuestionDisplay = useMemo(() => {
    return getQuestionDisplayText(activeQuestion, interviewLanguageMode);
  }, [activeQuestion, interviewLanguageMode]);
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
    const remotePreset = getRemoteSpeechPreset(selectedVoicePreset, speechLang);

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
          await speakWithBrowser(text, speechLang, t.browserSpeechFailed, selectedVoicePreset);
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
    setShowHint(false);
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
        setQuestions(loadedQuestions);
        setCurrentQuestion(nextIndex);
        setIsPaused(data.session.status === "PAUSED");
        setMessagesList([buildAiMessage(loadedQuestions[nextIndex], 1, resolvedMode)]);

        if (createdFromStaleSession && querySessionId) {
          router.replace(`/interview?sessionId=${data.session.id}${resolvedMode === "BILINGUAL" ? "&mode=bilingual" : ""}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : messages[getStoredLocale()].interview.createFailed;
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

  async function submitAnswer(answerText: string) {
    const answer = answerText.trim();
    if (!answer || !sessionId || isSubmitting || isPaused || isCompletingRef.current) {
      return;
    }

    const question = questions[currentQuestion];

    setIsSubmitting(true);
    setError("");
    const feedbackMessageId = Date.now();
    setInput("");
    setLiveTranscript("");
    setAutoSubmitCountdown(null);
    setMessagesList((current) => [
      ...current,
      {
        id: current.length + 1,
        author: "user",
        content: answer,
        time: getClockTime()
      },
      {
        id: feedbackMessageId,
        author: "ai",
        content: "",
        time: getClockTime()
      }
    ]);

    try {
      const result = await new Promise<SubmitInterviewAnswerResponse>((resolve, reject) => {
        const stream = streamInterviewAnswerFeedback({
          answerText: answer,
          sessionId,
          sessionQuestionId: question.id,
          onStatus: () => setIsThinking(true),
          onToken: (token) => {
            setMessagesList((current) =>
              current.map((message) =>
                message.id === feedbackMessageId
                  ? { ...message, content: `${message.content}${token}` }
                  : message
              )
            );
          },
          onDone: (data) => {
            feedbackStreamRef.current = null;
            cancelFeedbackStreamRef.current = null;
            resolve(data);
          },
          onError: (message) => {
            feedbackStreamRef.current = null;
            cancelFeedbackStreamRef.current = null;
            reject(new Error(message));
          }
        });
        feedbackStreamRef.current = stream;
        cancelFeedbackStreamRef.current = () => {
          stream.close();
          feedbackStreamRef.current = null;
          cancelFeedbackStreamRef.current = null;
          reject(new Error(completingInterviewSignal));
        };
      });

      if (isCompletingRef.current) return;

      setLastFeedback({
        feedback: result.answer.feedback,
        improvedAnswer: result.answer.improvedAnswer,
        scoreTotal: result.answer.scoreTotal
      });

      setMessagesList((current) => {
        const fallbackFeedback = `${t.feedbackPrefix}: ${result.answer.feedback ?? "Answer saved."}`;
        const scoreLine = result.answer.scoreTotal ? `${t.scorePrefix}: ${result.answer.scoreTotal}/10` : undefined;

        return current.map((message) =>
          message.id === feedbackMessageId
            ? {
                ...message,
                content: message.content || fallbackFeedback,
                translation: scoreLine
              }
            : message
        );
      });

      setInput("");

      const spokenFeedback = buildSpokenFeedback(result, t);
      if (interviewMode !== "TEXT" && spokenFeedback) {
        await speakText(spokenFeedback, { startListeningAfter: false });
      }

      if (result.session.status === "COMPLETED") {
        sessionStorage.setItem(activeInterviewSessionStorageKey, sessionId);
        router.push(`/interview/result?sessionId=${sessionId}`);
        return;
      }

      await advanceToNextQuestion(result.session.answeredQuestions);
    } catch (err) {
      if (err instanceof Error && err.message === completingInterviewSignal) return;
      if (isCompletingRef.current) return;
      setError(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      feedbackStreamRef.current = null;
      cancelFeedbackStreamRef.current = null;
      if (!isCompletingRef.current) {
        setIsSubmitting(false);
        setIsThinking(false);
      }
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
      setError(err instanceof Error ? err.message : "Khong cap nhat duoc trang thai tam dung.");
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
    cancelFeedbackStreamRef.current?.();
    feedbackStreamRef.current?.close();
    feedbackStreamRef.current = null;
    cancelFeedbackStreamRef.current = null;
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
    <main id="main-content" className="min-h-screen bg-[#f3f6f8] p-3 text-[#101b3f] sm:p-5 lg:h-screen lg:overflow-hidden" tabIndex={-1} aria-label={t.title}>
      <section className="mx-auto grid min-h-[calc(100vh-24px)] lg:h-full max-w-7xl grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-[#d8dee8] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
        <InterviewHeader
          elapsedSeconds={elapsedSeconds}
          isPaused={isPaused}
          isPauseChanging={isUpdatingPause}
          value={interviewLanguageMode}
          onChange={handleLanguageChange}
          onTogglePause={handleTogglePause}
          t={t}
        />

        <div className="grid gap-5 p-4 lg:grid-cols-[1.44fr_0.9fr] lg:p-6 min-h-0 flex-1">
          <section className="flex min-h-0 flex-col">
            <div className="relative min-h-[240px] flex-1 overflow-hidden rounded-lg border border-[#cfdaeb] bg-slate-200 shadow-sm">
              <Image
                src="/interview/interviewer.png"
                alt={t.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 max-w-[520px] rounded-lg border border-white/10 bg-slate-950/86 p-4 shadow-xl shadow-slate-950/20 backdrop-blur sm:bottom-6 sm:left-6 sm:right-6" aria-label={t.questionCard}>
                <p className="text-base font-black leading-7 text-white sm:text-lg" aria-live="polite">{displayedQuestion || activeQuestion.questionText}</p>
                {activeSubtitle ? (
                  <p className="mt-2 text-sm font-bold text-slate-300">
                    {activeSubtitle}
                  </p>
                ) : null}
              </div>
              <div className="absolute right-5 top-5 flex flex-wrap items-center justify-end gap-2">
                {activeQuestion.isFollowUp ? (
                  <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 shadow-lg">
                    {t.followUp} {activeQuestion.followUpDepth ? `x${activeQuestion.followUpDepth}` : ""}
                  </span>
                ) : null}
                <span className="rounded-lg border border-white/70 bg-white/88 px-4 py-2 text-sm font-black text-[#0a347d] shadow-lg">
                  {activeQuestion.category}
                </span>
              </div>
            </div>

            <InterviewControls
              interviewMode={interviewMode}
              isListening={isSpeaking}
              isRecording={voiceRecorder.isRecording}
              isSpeaking={isSpeaking}
              isTranscribing={voiceRecorder.isTranscribing}
              onModeChange={setInterviewMode}
              onToggleListening={handleSpeakQuestion}
              onToggleRecording={voiceRecorder.toggleRecording}
              t={t}
            />

            <InterviewStatusRail
              elapsedSeconds={elapsedSeconds}
              lastFeedback={lastFeedback}
              liveTranscript={liveTranscript}
              progress={progress}
              progressLabel={progressLabel}
              t={t}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <button type="button" onClick={handleTogglePause} disabled={isUpdatingPause} className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d8e3f2] bg-white px-4 py-2 text-sm font-black transition hover:bg-[#f6f8fb] disabled:opacity-50" aria-label={isPaused ? t.resume : t.pause}>
                {isPaused ? <Play size={16} /> : <Pause size={16} />} {isPaused ? t.resume : t.pause}
              </button>
              <button type="button" onClick={() => setShowHint((value) => !value)} className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700 transition hover:bg-amber-100" aria-controls="question-hint" aria-expanded={showHint}>
                <Lightbulb size={16} /> {t.hint}
              </button>
              <button type="button" onClick={handleSkipQuestion} disabled={isPaused || isThinking || isSubmitting || isUpdatingPause} className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d8e3f2] bg-white px-4 py-2 text-sm font-black transition hover:bg-[#f6f8fb] disabled:opacity-50" aria-label={t.skip}>
                <SkipForward size={16} /> {t.skip}
              </button>
              <button type="button" onClick={handleRetryQuestion} disabled={isPaused || isThinking || isSubmitting || isUpdatingPause} className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d8e3f2] bg-white px-4 py-2 text-sm font-black transition hover:bg-[#f6f8fb] disabled:opacity-50" aria-label={t.retry}>
                <RotateCcw size={16} /> {t.retry}
              </button>
            </div>

            <div className="mt-3 grid gap-2 rounded-lg border border-[#d8e3f2] bg-white px-4 py-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <label htmlFor="speech-voice" className="text-sm font-black text-[#51607b]">{t.voiceLabel}</label>
              <select
                id="speech-voice"
                value={selectedVoicePreset}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!isSpeechVoicePreset(value)) return;
                  setSelectedVoicePreset(value);
                  localStorage.setItem(speechVoiceStorageKey, value);
                }}
                className="focus-ring h-11 rounded-lg border border-[#d8e3f2] bg-white px-3 text-sm font-bold outline-none"
              >
                {voicePresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {getVoicePresetLabel(preset, t)}
                  </option>
                ))}
              </select>
            </div>

            {showHint ? (
              <div id="question-hint" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
                {activeQuestion.expectedAnswerLogic || activeQuestion.translation || t.hintFallback}
              </div>
            ) : null}

            <div className="mt-5 flex items-center gap-5">
              <p className="w-24 text-sm font-black text-[#51607b]">
                {progressLabel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#dce6f5]" role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                <div className="h-full rounded-full bg-[#1f62e0]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </section>

          <section className="flex min-h-[400px] lg:min-h-0 flex-col overflow-hidden rounded-lg border border-[#d2deee] bg-[#f4f8ff] shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-[#d2deee] bg-white/86 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-black">{t.conversation}</h2>
                <p className="mt-1 text-xs font-bold text-[#6a7891]">
                  {isLoadingSession ? t.loading : t.modeHelp}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCompleteInterview}
                disabled={!completeTargetSessionId || isCompleting}
                aria-busy={isCompleting}
                className="focus-ring min-h-11 rounded-lg bg-[#d92c3d] px-4 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:bg-[#b91f2f] disabled:cursor-wait disabled:opacity-65"
              >
                {isCompleting ? t.completing : t.complete}
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
              {error ? (
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
                  {error}
                </div>
              ) : null}
              {messagesList.map((message) => (
                <ChatBubble key={message.id} message={message} t={t} />
              ))}
              {liveTranscript ? (
                <ChatBubble
                  message={{
                    author: "user",
                    content: liveTranscript,
                    id: -1,
                    time: getClockTime(),
                    translation: autoSubmitCountdown ? interpolate(t.sendingIn, { seconds: autoSubmitCountdown }) : t.listeningStatus
                  }}
                  t={t}
                />
              ) : null}
              {autoSubmitCountdown && !liveTranscript ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700" role="status">
                  {interpolate(t.sendingIn, { seconds: autoSubmitCountdown })}
                </div>
              ) : null}
              {isThinking ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700" role="status">
                  {t.thinking}
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[#d2deee] bg-white/92 p-4" aria-label={t.answerLabel}>
              <p className="sr-only" id="answer-input-help">{t.answerInputHelp}</p>
              <div className="flex items-center gap-3 rounded-lg border border-[#d6e0ef] bg-white px-4 py-3 shadow-sm">
                <label className="sr-only" htmlFor="interview-answer">{t.answerLabel}</label>
                <input
                  id="interview-answer"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={isLoadingSession || isSubmitting || isPaused || isUpdatingPause}
                  aria-describedby="answer-input-help"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none placeholder:text-[#9aa6bb]"
                  placeholder={voiceRecorder.isRecording ? t.recordingPlaceholder : t.answerPlaceholder}
                />
                <button
                  type="submit"
                  disabled={isLoadingSession || isSubmitting || isPaused || isUpdatingPause}
                  className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8f1ff] text-[#0a347d] transition hover:bg-[#d9e8ff]"
                  aria-label={t.sendAnswer}
                >
                  <Send size={19} />
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
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

function buildSpokenFeedback(result: SubmitInterviewAnswerResponse, t: (typeof messages)["vi"]["interview"]) {
  const feedback = result.answer.feedback?.trim();
  const score = result.answer.scoreTotal?.trim();
  return [
    score ? `${t.scorePrefix}: ${score}/10.` : "",
    feedback ? `${t.feedbackPrefix}: ${feedback}` : ""
  ].filter(Boolean).join(" ");
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
  progress,
  progressLabel,
  t
}: {
  elapsedSeconds: number;
  lastFeedback: LastFeedback | null;
  liveTranscript: string;
  progress: number;
  progressLabel: string;
  t: (typeof messages)["vi"]["interview"];
}) {
  return (
    <section className="mt-4 grid gap-3 md:grid-cols-3" aria-label={t.answerControls}>
      <div className="rounded-lg border border-[#d8e3f2] bg-white p-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#51607b]">{t.timer}</p>
        <p className="mt-2 text-2xl font-black tabular-nums text-[#0a347d]">{formatElapsed(elapsedSeconds)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dce6f5]" role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="h-full rounded-full bg-[#1f62e0]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs font-bold text-[#51607b]">{progressLabel}</p>
      </div>

      <div className="rounded-lg border border-[#d8e3f2] bg-white p-4" aria-live="polite">
        <p className="text-xs font-black uppercase tracking-wide text-[#51607b]">{t.transcript}</p>
        <p className="mt-2 min-h-12 text-sm font-bold leading-6 text-[#243252]">
          {liveTranscript || t.answerInputHelp}
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
    </section>
  );
}

function InterviewHeader({
  elapsedSeconds,
  isPauseChanging,
  isPaused,
  value,
  onChange,
  onTogglePause,
  t
}: {
  elapsedSeconds: number;
  isPauseChanging: boolean;
  isPaused: boolean;
  value: InterviewLanguageMode;
  onChange: (mode: InterviewLanguageMode) => void;
  onTogglePause: () => void;
  t: (typeof messages)["vi"]["interview"];
}) {
  return (
    <header className="grid gap-4 border-b border-[#d8e3f2] bg-white px-5 py-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <Link href="/dashboard" className="focus-ring inline-flex min-h-11 items-center gap-3 text-lg font-black" aria-label={t.backToDashboard}>
        <span className="flex h-11 w-11 items-center justify-center rounded-lg text-[#101b3f] transition hover:bg-[#eef4ff]">
          <ArrowLeft size={22} />
        </span>
        {t.title}
      </Link>

      <button type="button" onClick={onTogglePause} disabled={isPauseChanging} className="focus-ring inline-flex min-h-11 items-center justify-center gap-3 rounded-lg border border-[#d8e3f2] bg-white px-6 text-xl font-black tracking-wide shadow-sm transition hover:bg-[#f6f8fb] disabled:opacity-50" aria-label={isPaused ? t.resume : t.pause}>
        <Timer size={18} />
        {formatElapsed(elapsedSeconds)}
        {isPaused ? <Play size={16} /> : <Pause size={16} />}
      </button>

      <div className="flex items-center justify-start gap-4 md:justify-end">
        <span className="text-sm font-black text-[#51607b]">{t.language}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as InterviewLanguageMode)}
          className="focus-ring inline-flex min-h-11 min-w-[150px] cursor-pointer items-center justify-center rounded-lg border border-[#d8e3f2] bg-white px-4 text-sm font-black shadow-sm outline-none"
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
    <div className="mx-auto mt-5 w-full max-w-[620px] rounded-lg border border-[#dbe5f3] bg-white px-4 py-3 shadow-sm">
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-[#f3f7ff] p-1 text-xs font-black">
        {(["TEXT", "VOICE", "HYBRID"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange(mode)}
            className={`focus-ring min-h-11 rounded-lg px-3 py-2 transition ${interviewMode === mode ? "bg-white text-[#0a347d] shadow-sm" : "text-[#6a7891]"}`}
            aria-pressed={interviewMode === mode}
          >
            {modeLabels[mode]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3">
        <button type="button" onClick={onToggleRecording} disabled={interviewMode === "TEXT" || isTranscribing} className="focus-ring flex min-h-24 flex-col items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition hover:bg-[#f3f7ff] disabled:cursor-not-allowed disabled:opacity-45">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ${isRecording ? "bg-[#f3374d] shadow-red-500/25" : "bg-[#0a9f7a] shadow-emerald-500/25"}`}>
            {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={21} />}
          </span>
          {isTranscribing ? t.transcribing : isRecording ? t.stopRecording : t.micOn}
        </button>
        <button type="button" onClick={onToggleListening} disabled={isListening} className="focus-ring flex min-h-24 flex-col items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition hover:bg-[#f3f7ff] disabled:cursor-wait disabled:opacity-70">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ${isListening ? "bg-[#f3374d] shadow-red-500/25" : "bg-[#1f62e0] shadow-blue-500/25"}`}>
            {isListening ? <Square size={18} fill="currentColor" /> : <Volume2 size={21} />}
          </span>
          {isListening ? t.speaking : t.speakQuestion}
        </button>
        <button type="button" onClick={() => onModeChange("TEXT")} disabled={isSpeaking} className="focus-ring flex min-h-24 flex-col items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition hover:bg-[#f3f7ff] disabled:cursor-not-allowed disabled:opacity-45">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f8fe] text-[#314478]">
            <Keyboard size={22} />
          </span>
          {t.textMode}
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ message, t }: { message: ChatMessage; t: (typeof messages)["vi"]["interview"] }) {
  const isAi = message.author === "ai";

  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-3 sm:grid-cols-[auto_1fr_auto]" aria-label={isAi ? t.ai : t.you}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white ${isAi ? "bg-[#0a347d]" : "bg-[#e9eef7] text-[#203154]"}`}>
        {isAi ? t.ai : t.you}
      </div>
      <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-bold leading-6 text-[#243252]">{message.content}</p>
        {message.translation ? (
          <p className="mt-1 text-xs font-semibold leading-5 text-[#6f7d94]">{message.translation}</p>
        ) : null}
      </div>
      <span className="hidden pt-3 text-xs font-bold text-[#8794aa] sm:block">{message.time}</span>
    </div>
  );
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

function getPresetRate(lang: string, preset: SpeechVoicePreset) {
  if (preset === "slow") return lang === "zh-CN" ? 0.92 : 0.95;
  if (preset === "clear") return lang === "zh-CN" ? 1.06 : 1.08;
  if (preset === "warm") return lang === "zh-CN" ? 0.98 : 1;
  return lang === "zh-CN" ? 1.02 : 1.04;
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

function getRemoteSpeechPreset(preset: SpeechVoicePreset, lang: string): { voice: RemoteSpeechVoice; speed: number } {
  const speed = getPresetRate(lang, preset);
  if (preset === "male") return { voice: "onyx", speed };
  if (preset === "warm") return { voice: "shimmer", speed };
  if (preset === "clear") return { voice: "shimmer", speed };
  return { voice: "nova", speed };
}

async function speakWithBrowser(text: string, lang: string, errorMessage: string, preset: SpeechVoicePreset = "auto") {
  const voices = await getBrowserVoices();
  const voice = pickPresetVoice(voices, lang, preset);

  if (!voice) {
    const presetLabel = preset === "female" ? "n\u1eef" : preset === "male" ? "nam" : "ph\u00f9 h\u1ee3p";
    throw new MissingBrowserVoiceError(`M\u00e1y ch\u01b0a c\u00f3 gi\u1ecdng ${presetLabel} cho ${lang}.`);
  }

  return new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? lang;
    utterance.rate = getPresetRate(lang, preset);
    utterance.pitch = getPresetPitch(preset);
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error(errorMessage));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}
