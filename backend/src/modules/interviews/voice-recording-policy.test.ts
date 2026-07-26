import { describe, expect, it } from "vitest";
import { hasVoiceRecordingPayload } from "./voice-recording-policy.js";

describe("hasVoiceRecordingPayload", () => {
  it("does not create a voice record for a keyboard answer", () => {
    expect(hasVoiceRecordingPayload({})).toBe(false);
    expect(hasVoiceRecordingPayload({ speechTranscript: "   " })).toBe(false);
  });

  it("creates a voice record when real speech evidence exists", () => {
    expect(hasVoiceRecordingPayload({ speechTranscript: "这是我的回答" })).toBe(true);
    expect(hasVoiceRecordingPayload({ speechMetrics: { wpm: 105 } })).toBe(true);
    expect(hasVoiceRecordingPayload({ pronunciation: { score: 82 } })).toBe(true);
  });
});
