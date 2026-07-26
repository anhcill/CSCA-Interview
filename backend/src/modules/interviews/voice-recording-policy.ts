export type VoiceRecordingPayload = {
  pronunciation?: unknown | null;
  speechMetrics?: unknown | null;
  speechTranscript?: string | null;
};

export function hasVoiceRecordingPayload(input: VoiceRecordingPayload) {
  return Boolean(
    input.speechMetrics
    || input.pronunciation
    || input.speechTranscript?.trim()
  );
}
