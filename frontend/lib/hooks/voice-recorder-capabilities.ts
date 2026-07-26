export type VoiceRecorderTransport = "browser" | "server" | "unsupported";

type VoiceRecorderCapabilities = {
  hasBrowserRecognition: boolean;
  hasMediaRecorder: boolean;
};

export function selectVoiceRecorderTransport(
  capabilities: VoiceRecorderCapabilities
): VoiceRecorderTransport {
  if (capabilities.hasBrowserRecognition) return "browser";
  if (capabilities.hasMediaRecorder) return "server";
  return "unsupported";
}

