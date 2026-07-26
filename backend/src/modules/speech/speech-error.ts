const unsupportedProviderPattern = /<!DOCTYPE|404/i;
const providerAuthenticationPattern = /Invalid or revoked API key|invalid_api_key|authentication_error/i;

export function toPublicTranscriptionErrorMessage(rawMessage: string) {
  if (providerAuthenticationPattern.test(rawMessage)) {
    return "Dịch vụ nhận dạng giọng nói trên server chưa sẵn sàng. Hãy dùng Chrome hoặc Edge để nhận dạng trực tiếp trên trình duyệt.";
  }

  if (unsupportedProviderPattern.test(rawMessage)) {
    return "Provider AI hiện không hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome/Edge để nhận dạng trực tiếp trên trình duyệt.";
  }

  return "Không thể nhận dạng giọng nói lúc này. Hãy bấm Thu lại hoặc nhập câu trả lời bằng bàn phím.";
}
