"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker, FaceLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { analyzeVisualFrame, emptyVisualAnalysis, type VisualAnalysisSnapshot } from "../visual-analysis";

export type FaceAnalysisStatus = "idle" | "loading" | "ready" | "running" | "error" | "unsupported";

type UseFaceAnalysisOptions = {
  autoStart?: boolean;
  cameraConstraints?: MediaTrackConstraints;
  delegate?: "CPU" | "GPU";
  includeAudioCheck?: boolean;
  modelAssetPath?: string;
  targetFps?: number;
  wasmBasePath?: string;
  onError?: (message: string) => void;
};

const defaultModelAssetPath =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const defaultWasmBasePath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

function getMediaErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Khong the truy cap camera/microphone";
    if (error.name === "NotFoundError") return "Khong tim thay camera/microphone";
    if (error.name === "NotReadableError") return "Camera hoac microphone dang duoc ung dung khac su dung";
  }
  return error instanceof Error ? error.message : "Khong the khoi tao nhan dien khuon mat";
}

function flattenBlendshapes(result: FaceLandmarkerResult) {
  const categories = result.faceBlendshapes?.[0]?.categories ?? [];
  return categories.reduce<Record<string, number>>((acc, category) => {
    acc[category.categoryName.toLowerCase()] = category.score;
    return acc;
  }, {});
}

function getBrightness(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const width = 48;
  const height = 36;
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;

  context.drawImage(video, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  let total = 0;

  for (let index = 0; index < data.length; index += 4) {
    total += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
  }

  return total / (data.length / 4) / 255;
}

export function useFaceAnalysis(options: UseFaceAnalysisOptions = {}) {
  const {
    autoStart = false,
    cameraConstraints,
    delegate = "GPU",
    includeAudioCheck = true,
    modelAssetPath = defaultModelAssetPath,
    targetFps = 8,
    wasmBasePath = defaultWasmBasePath,
    onError
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const brightnessCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef<VisualAnalysisSnapshot>(emptyVisualAnalysis);

  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<VisualAnalysisSnapshot>(emptyVisualAnalysis);
  const [status, setStatus] = useState<FaceAnalysisStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setStatus("idle");
  }, []);

  const runFrame = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      frameRef.current = window.requestAnimationFrame(runFrame);
      return;
    }

    const now = performance.now();
    const minFrameGap = 1000 / Math.max(1, targetFps);
    if (now - lastFrameAtRef.current >= minFrameGap) {
      lastFrameAtRef.current = now;
      const result = landmarker.detectForVideo(video, now);
      const canvas = brightnessCanvasRef.current ?? document.createElement("canvas");
      brightnessCanvasRef.current = canvas;

      const nextSnapshot = analyzeVisualFrame({
        blendshapes: flattenBlendshapes(result),
        brightness: getBrightness(video, canvas),
        hasCameraTrack: Boolean(streamRef.current?.getVideoTracks().some((track) => track.readyState === "live")),
        hasMicTrack: Boolean(streamRef.current?.getAudioTracks().some((track) => track.readyState === "live")),
        landmarks: result.faceLandmarks[0] as NormalizedLandmark[] | undefined,
        previous: snapshotRef.current,
        timestamp: Date.now()
      });

      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
    }

    frameRef.current = window.requestAnimationFrame(runFrame);
  }, [targetFps]);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError("Trinh duyet khong ho tro camera");
      return;
    }

    stop();
    setError("");
    setStatus("loading");

    try {
      const [{ FaceLandmarker, FilesetResolver }, mediaStream] = await Promise.all([
        import("@mediapipe/tasks-vision"),
        navigator.mediaDevices.getUserMedia({
          audio: includeAudioCheck,
          video: cameraConstraints ?? { facingMode: "user", height: { ideal: 720 }, width: { ideal: 1280 } }
        })
      ]);

      const fileset = await FilesetResolver.forVisionTasks(wasmBasePath);
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          delegate,
          modelAssetPath
        },
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO"
      });

      landmarkerRef.current = landmarker;
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setStatus("ready");

      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setStatus("running");
      frameRef.current = window.requestAnimationFrame(runFrame);
    } catch (err) {
      const message = getMediaErrorMessage(err);
      setError(message);
      setStatus("error");
      onError?.(message);
      stop();
    }
  }, [cameraConstraints, delegate, includeAudioCheck, modelAssetPath, onError, runFrame, stop, wasmBasePath]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [stream]);

  useEffect(() => {
    if (!autoStart) return;
    void start();
    return stop;
  }, [autoStart, start, stop]);

  useEffect(() => stop, [stop]);

  return {
    canStartInterview:
      snapshot.checks.camera === "ok" &&
      snapshot.checks.faceVisible === "ok" &&
      snapshot.checks.centered !== "error" &&
      snapshot.checks.lighting !== "error",
    checks: snapshot.checks,
    error,
    features: snapshot.features,
    isRunning: status === "running",
    scores: snapshot.scores,
    snapshot,
    start,
    status,
    stop,
    stream,
    videoRef
  };
}
