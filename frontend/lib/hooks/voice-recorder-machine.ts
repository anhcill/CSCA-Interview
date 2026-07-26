export type VoiceRecorderState =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "LISTENING"
  | "SPEECH_DETECTED"
  | "WAITING_FOR_MORE"
  | "TRANSCRIBING"
  | "REVIEW"
  | "SUBMITTING";

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
  if (input.nowMs - input.recordingStartedAtMs < 2500) return false;
  return input.nowMs - input.silenceStartedAtMs >= 4500;
}
