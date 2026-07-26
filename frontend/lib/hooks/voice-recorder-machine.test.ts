import { describe, expect, it } from "vitest";
import {
  canTransitionVoiceRecorder,
  shouldStopAfterSilence
} from "./voice-recorder-machine";

describe("voice recorder machine", () => {
  it("does not stop before speech is detected", () => {
    expect(shouldStopAfterSilence({
      hasDetectedSpeech: false,
      nowMs: 10_000,
      recordingStartedAtMs: 0,
      silenceStartedAtMs: 1_000
    })).toBe(false);
  });

  it("keeps listening after two seconds of silence", () => {
    expect(shouldStopAfterSilence({
      hasDetectedSpeech: true,
      nowMs: 5_000,
      recordingStartedAtMs: 0,
      silenceStartedAtMs: 3_000
    })).toBe(false);
  });

  it("moves to review after 2.5 seconds of silence", () => {
    expect(shouldStopAfterSilence({
      hasDetectedSpeech: true,
      nowMs: 6_000,
      recordingStartedAtMs: 0,
      silenceStartedAtMs: 3_500
    })).toBe(true);
  });

  it("prevents invalid direct transitions", () => {
    expect(canTransitionVoiceRecorder("IDLE", "SUBMITTING")).toBe(false);
    expect(canTransitionVoiceRecorder("TRANSCRIBING", "SUBMITTING")).toBe(false);
    expect(canTransitionVoiceRecorder("TRANSCRIBING", "REVIEW")).toBe(true);
    expect(canTransitionVoiceRecorder("REVIEW", "SUBMITTING")).toBe(true);
  });
});
