import { describe, expect, it } from "vitest";
import { selectVoiceRecorderTransport } from "./voice-recorder-capabilities";

describe("selectVoiceRecorderTransport", () => {
  it("ưu tiên nhận dạng trực tiếp trên trình duyệt", () => {
    expect(selectVoiceRecorderTransport({
      hasBrowserRecognition: true,
      hasMediaRecorder: true
    })).toBe("browser");
  });

  it("chỉ gửi audio lên server khi trình duyệt không hỗ trợ nhận dạng", () => {
    expect(selectVoiceRecorderTransport({
      hasBrowserRecognition: false,
      hasMediaRecorder: true
    })).toBe("server");
  });

  it("báo không hỗ trợ khi thiếu cả hai khả năng", () => {
    expect(selectVoiceRecorderTransport({
      hasBrowserRecognition: false,
      hasMediaRecorder: false
    })).toBe("unsupported");
  });
});

