import { describe, expect, it } from "vitest";
import { toPublicTranscriptionErrorMessage } from "./speech-error.js";

describe("toPublicTranscriptionErrorMessage", () => {
  it("không để lộ lỗi nội bộ của SDK cho người dùng", () => {
    const message = toPublicTranscriptionErrorMessage(
      "Cannot read properties of undefined (reading '_client')"
    );

    expect(message).not.toContain("_client");
    expect(message).toContain("Không thể nhận dạng giọng nói");
  });

  it("hướng dẫn fallback trình duyệt khi provider không hỗ trợ endpoint", () => {
    expect(toPublicTranscriptionErrorMessage("404 <!DOCTYPE html>")).toContain("Chrome/Edge");
  });
});
