export type VoiceRecorderState =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "LISTENING"
  | "SPEECH_DETECTED"
  | "WAITING_FOR_MORE"
  | "TRANSCRIBING"
  | "REVIEW"
  | "SUBMITTING";

export const VOICE_MIN_RECORDING_MS = 1000;
export const VOICE_SILENCE_FINALIZE_MS = 2500;
export const VOICE_REVIEW_AUTO_SEND_MS = 3000;

const allowedTransitions: Record<VoiceRecorderState, VoiceRecorderState[]> = {
  IDLE: ["REQUESTING_PERMISSION"],
  REQUESTING_PERMISSION: ["IDLE", "LISTENING"],
  LISTENING: ["IDLE", "SPEECH_DETECTED"],
  SPEECH_DETECTED: ["IDLE", "WAITING_FOR_MORE", "TRANSCRIBING"],
  WAITING_FOR_MORE: ["IDLE", "SPEECH_DETECTED", "TRANSCRIBING"],
  TRANSCRIBING: ["IDLE", "REVIEW"],
  REVIEW: ["IDLE", "REQUESTING_PERMISSION", "SUBMITTING"],
  SUBMITTING: ["IDLE", "REVIEW"]
};

export function canTransitionVoiceRecorder(
  current: VoiceRecorderState,
  next: VoiceRecorderState
) {
  return current === next || allowedTransitions[current].includes(next);
}

export function getVoiceRecorderStateLabel(state: VoiceRecorderState) {
  const labels: Record<VoiceRecorderState, string> = {
    IDLE: "Mic đang tắt",
    LISTENING: "Đang lắng nghe",
    REQUESTING_PERMISSION: "Đang xin quyền dùng mic",
    REVIEW: "Chờ bạn xác nhận",
    SPEECH_DETECTED: "Đã nhận giọng nói",
    SUBMITTING: "Đang gửi câu trả lời",
    TRANSCRIBING: "Đang nhận dạng giọng nói",
    WAITING_FOR_MORE: "Đang chờ bạn nói tiếp"
  };
  return labels[state];
}

export function shouldStopAfterSilence(input: {
  hasDetectedSpeech: boolean;
  nowMs: number;
  recordingStartedAtMs: number;
  silenceStartedAtMs: number | null;
}) {
  if (!input.hasDetectedSpeech || input.silenceStartedAtMs === null) return false;
  if (input.nowMs - input.recordingStartedAtMs < VOICE_MIN_RECORDING_MS) return false;
  return input.nowMs - input.silenceStartedAtMs >= VOICE_SILENCE_FINALIZE_MS;
}
