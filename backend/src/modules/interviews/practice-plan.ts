export type PracticePlanDay = {
  activities: string[];
  day: number;
  focus: string;
  target: string;
  title: string;
};

export function buildSevenDayPracticePlan(input: {
  hasSpeech: boolean;
  targetMajor?: string | null;
  weaknesses: string[];
  weakestCriterion: string;
}): PracticePlanDay[] {
  const major = input.targetMajor?.trim() || "ngành mục tiêu";
  const priority = input.weaknesses.slice(0, 3);
  return [
    { activities: [priority.length ? `Sửa lần lượt: ${priority.join("; ")}` : "Chọn 3 câu có điểm thấp nhất và viết lại", "Đánh dấu bằng chứng còn thiếu"], day: 1, focus: input.weakestCriterion, target: "Hoàn thiện 3 câu yếu nhất", title: "Rà soát điểm yếu" },
    { activities: ["Lập dàn ý: kết luận, bằng chứng, liên hệ mục tiêu", "Trả lời 5 câu trong 60–90 giây/câu"], day: 2, focus: "Logic", target: "Mỗi câu có cấu trúc rõ và không lặp ý", title: "Cấu trúc câu trả lời" },
    { activities: ["Chuẩn bị 3 ví dụ cá nhân có bối cảnh và kết quả", "Thay câu chung chung bằng dữ kiện thật"], day: 3, focus: "Minh chứng", target: "Mỗi câu chính có ít nhất 1 ví dụ kiểm chứng được", title: "Bổ sung bằng chứng" },
    { activities: [`Ôn 5 khái niệm cốt lõi của ${major}`, "Tập giải thích một vấn đề cho người không chuyên"], day: 4, focus: "Chuyên ngành", target: "Trả lời được 3 câu đào sâu cấp 2–3", title: "Đào sâu chuyên môn" },
    { activities: ["Ghi lại 10 từ/cấu trúc thường dùng sai", "Viết lại 3 câu bằng đúng ngôn ngữ phỏng vấn"], day: 5, focus: "Ngôn ngữ", target: "Giảm lỗi ngữ pháp và tránh trộn ngôn ngữ", title: "Chuẩn hóa ngôn ngữ" },
    { activities: input.hasSpeech ? ["Ghi âm 5 câu, nghe lại tốc độ và khoảng dừng", "Thu lại các câu có phát âm hoặc độ trôi chảy thấp"] : ["Đọc thành tiếng 5 câu trong 60–90 giây/câu", "Tập phản xạ không nhìn toàn bộ kịch bản"], day: 6, focus: input.hasSpeech ? "Giọng nói" : "Phản xạ", target: input.hasSpeech ? "Nhịp nói ổn định, ít từ đệm và ngắt dài" : "Trả lời liền mạch bằng dàn ý ngắn", title: input.hasSpeech ? "Luyện giọng nói" : "Luyện phản xạ" },
    { activities: ["Thực hiện một buổi phỏng vấn đủ 7 phần", "So sánh điểm và lỗi với báo cáo hiện tại"], day: 7, focus: "Mô phỏng toàn buổi", target: "Tăng điểm tiêu chí yếu nhất và không lặp lỗi trọng yếu", title: "Phỏng vấn thử" }
  ];
}
