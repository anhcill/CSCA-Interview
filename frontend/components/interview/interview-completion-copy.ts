export type InterviewCompletionStage = "scoring" | "opening_result";

export function getInterviewCompletionCopy(stage: InterviewCompletionStage) {
  if (stage === "opening_result") {
    return {
      description: "Báo cáo đã hoàn tất. Hệ thống đang mở trang kết quả cho bạn.",
      title: "Đang mở báo cáo phỏng vấn"
    };
  }

  return {
    description: "AI đang chấm từng câu trả lời, tổng hợp điểm mạnh và đề xuất cải thiện. Vui lòng không đóng trang.",
    title: "AI đang tổng hợp kết quả"
  };
}

