const unsupportedProviderPattern = /<!DOCTYPE|404/i;

export function toPublicTranscriptionErrorMessage(rawMessage: string) {
  if (unsupportedProviderPattern.test(rawMessage)) {
    return "Provider AI hiện không hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome/Edge để nhận dạng trực tiếp trên trình duyệt.";
  }

  return "Không thể nhận dạng giọng nói lúc này. Hãy bấm Thu lại hoặc nhập câu trả lời bằng bàn phím.";
}
