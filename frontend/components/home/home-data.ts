export const featureStrip = [
  {
    icon: "message",
    title: "中文面试 AI",
    description: "hỏi đáp theo mạch thật"
  },
  {
    icon: "clipboard",
    title: "Hồ sơ CSC",
    description: "trường, ngành, học bổng"
  },
  {
    icon: "graduation",
    title: "Luyện song ngữ",
    description: "Trung / Việt / Anh"
  },
  {
    icon: "chart",
    title: "Báo cáo hồ sơ nộp",
    description: "điểm yếu và gợi ý sửa"
  }
] as const;

export const stats = [
  { value: "CSC", label: "ngữ cảnh luyện theo học bổng và trường Trung Quốc" },
  { value: "10", label: "câu hỏi tối đa trong một phòng luyện" },
  { value: "3", label: "ngôn ngữ phỏng vấn: Trung / Việt / Anh" }
] as const;

export const chinaPathCards = [
  {
    label: "选校",
    title: "Chọn trường và thành phố",
    description: "Chuẩn bị cách nói về lý do chọn trường, ngành, thành phố và môi trường học thuật tại Trung Quốc.",
    tags: ["Bắc Kinh", "Thượng Hải", "Hàng Châu"]
  },
  {
    label: "奖学金",
    title: "Nối hồ sơ với học bổng",
    description: "Luyện câu trả lời về GPA, thành tích, nghiên cứu, hoạt động và lý do bạn phù hợp với học bổng.",
    tags: ["CSC", "校奖", "导师面试"]
  },
  {
    label: "面试",
    title: "Trả lời như buổi vấn đáp thật",
    description: "Tập diễn đạt bằng tiếng Trung hoặc song ngữ, có luận điểm, ví dụ, kế hoạch học tập và kế hoạch sau tốt nghiệp.",
    tags: ["中文回答", "Kế hoạch học tập", "Kế hoạch nghề nghiệp"]
  }
] as const;

export const audienceCards = [
  {
    icon: "school",
    title: "Ứng viên mới bắt đầu nộp hồ sơ",
    description: "Nắm nhanh dạng câu hỏi thường gặp, cách giới thiệu bản thân và cách nối câu trả lời với mục tiêu học tập.",
    bullets: ["Định hình câu chuyện cá nhân", "Tập trả lời câu hỏi nền tảng", "Giảm lúng túng khi mở đầu"]
  },
  {
    icon: "book",
    title: "Ứng viên đã có kế hoạch học tập",
    description: "Kiểm tra độ logic giữa ngành học, trường, kế hoạch nghiên cứu và định hướng nghề nghiệp sau tốt nghiệp.",
    bullets: ["Sửa mạch trả lời học thuật", "Bổ sung ví dụ cụ thể", "Chuẩn bị câu hỏi follow-up"]
  },
  {
    icon: "chart",
    title: "Mentor hoặc trung tâm tư vấn",
    description: "Theo dõi tiến độ luyện của học viên, nhìn nhanh điểm yếu lặp lại và ưu tiên phần cần sửa trước lịch phỏng vấn.",
    bullets: ["Chuẩn hóa quy trình luyện", "Lưu lịch sử buổi tập", "Đọc báo cáo sau buổi luyện"]
  }
] as const;

export const detailFeatures = [
  {
    icon: "school",
    title: "Cá nhân hóa theo hồ sơ nộp",
    description:
      "Hệ thống dùng trường, ngành, bậc học, học bổng và kế hoạch học tập để tạo bộ câu hỏi sát mục tiêu."
  },
  {
    icon: "message",
    title: "Mạch hỏi như buổi vấn đáp",
    description:
      "Sau mỗi câu trả lời, phòng phỏng vấn có thể chuyển câu tiếp theo hoặc hỏi sâu hơn vào điểm bạn vừa nêu."
  },
  {
    icon: "shield",
    title: "Phản hồi có thể sửa ngay",
    description:
      "AI chấm mức độ liên quan, logic, độ cụ thể và ngôn ngữ, kèm phiên bản trả lời tốt hơn."
  },
  {
    icon: "chart",
    title: "Theo dõi tiến bộ luyện tập",
    description:
      "Lịch sử phỏng vấn lưu câu trả lời, điểm số và báo cáo để bạn thấy phần nào cần luyện thêm."
  }
] as const;

export const interviewPreview = [
  {
    label: "Trước buổi luyện",
    title: "Hệ thống đọc mục tiêu nộp hồ sơ",
    description: "Bạn nhập trường, ngành, bậc học, học bổng, ngôn ngữ luyện và ghi chú kế hoạch học tập để AI hiểu bối cảnh.",
    items: ["Tự tạo bộ câu hỏi theo hồ sơ", "Ưu tiên điểm hội đồng thường hỏi", "Chọn mức khó theo năng lực hiện tại"]
  },
  {
    label: "Trong phòng luyện",
    title: "Câu hỏi đi theo mạch phỏng vấn",
    description: "Buổi luyện không chỉ là danh sách câu hỏi rời rạc. AI nối tiếp bằng câu hỏi đào sâu khi câu trả lời còn chung chung.",
    items: ["Trả lời bằng văn bản hoặc giọng nói", "Theo dõi số câu đã hoàn thành", "Nhận nhắc nhẹ khi câu trả lời thiếu ý"]
  },
  {
    label: "Sau buổi luyện",
    title: "Báo cáo chỉ rõ điểm cần sửa",
    description: "Mỗi câu trả lời được chấm theo tiêu chí rõ ràng, kèm nhận xét ngắn và phiên bản trả lời tốt hơn để luyện lại.",
    items: ["Điểm liên quan, logic, cụ thể, ngôn ngữ", "Gợi ý sửa theo từng câu", "Lưu lịch sử để so sánh tiến bộ"]
  }
] as const;

export const steps = [
  {
    number: "01",
    title: "Điền hồ sơ nộp",
    description: "Nhập trường, ngành, học bổng, bậc học và kế hoạch học tập để hệ thống hiểu mục tiêu của bạn."
  },
  {
    number: "02",
    title: "Tạo phòng phỏng vấn",
    description: "AI chọn câu hỏi phù hợp, ưu tiên ngữ cảnh du học Trung Quốc và mục tiêu học bổng."
  },
  {
    number: "03",
    title: "Trả lời và nhận phản hồi",
    description: "Bạn trả lời bằng text hoặc voice, hệ thống chấm điểm và gợi ý cách diễn đạt tốt hơn."
  },
  {
    number: "04",
    title: "Luyện lại theo báo cáo",
    description: "Xem lịch sử, điểm yếu lặp lại và danh sách việc cần luyện trước buổi phỏng vấn thật."
  }
] as const;

export const scholarshipFocus = [
  {
    title: "Hồ sơ học thuật",
    description: "Luyện cách nói về GPA, môn mạnh, nghiên cứu, dự án và lý do nền tảng hiện tại phù hợp với ngành muốn học."
  },
  {
    title: "Động lực chọn Trung Quốc",
    description: "Chuẩn bị câu trả lời về trường, thành phố, chương trình đào tạo, môi trường học thuật và kế hoạch hòa nhập."
  },
  {
    title: "Kế hoạch học tập",
    description: "Kiểm tra câu trả lời về hướng học, môn muốn theo, đề tài quan tâm và cách đo kết quả trong từng giai đoạn."
  },
  {
    title: "Kế hoạch sau tốt nghiệp",
    description: "Liên kết học bổng với mục tiêu nghề nghiệp, đóng góp sau khi về nước và năng lực bạn cần phát triển."
  }
] as const;

export const pricing = [
  {
    name: "Dùng thử",
    price: "Miễn phí",
    description: "Phù hợp khi bạn muốn trải nghiệm một phòng luyện cơ bản.",
    items: ["Tạo tài khoản", "Tạo phòng phỏng vấn", "Nhận phản hồi sau câu trả lời"],
    highlighted: false
  },
  {
    name: "Luyện cá nhân",
    price: "Sắp ra mắt",
    description: "Cho ứng viên cần luyện đều trước lịch phỏng vấn học bổng.",
    items: ["Câu hỏi theo hồ sơ", "Lịch sử luyện tập", "Báo cáo điểm yếu và gợi ý sửa"],
    highlighted: true
  },
  {
    name: "Trung tâm",
    price: "Liên hệ",
    description: "Cho mentor hoặc trung tâm tư vấn cần theo dõi nhiều học viên.",
    items: ["Quản lý kho câu hỏi", "Theo dõi học viên", "Báo cáo kết quả luyện"],
    highlighted: false
  }
] as const;

export const featurePageGroups = [
  {
    title: "Cá nhân hóa hồ sơ",
    description: "Không dùng chung một bộ câu hỏi cho mọi ứng viên. Hệ thống đọc mục tiêu nộp hồ sơ để chọn câu hỏi sát hơn.",
    items: ["Trường, ngành, bậc học", "Loại học bổng", "Kế hoạch học tập và mục tiêu nghề nghiệp", "Ngôn ngữ luyện phỏng vấn"]
  },
  {
    title: "Luyện vấn đáp",
    description: "Mô phỏng nhịp hỏi đáp thật, có mở đầu, câu hỏi chính, câu hỏi đào sâu và phần tổng kết sau buổi luyện.",
    items: ["Câu hỏi theo phiên", "Trả lời text hoặc voice", "Theo dõi tiến độ từng câu", "Lưu lại câu trả lời"]
  },
  {
    title: "Phản hồi hành động được",
    description: "Phản hồi tập trung vào việc sửa câu trả lời, không chỉ đưa điểm. Bạn biết câu nào thiếu ví dụ, câu nào thiếu logic.",
    items: ["Điểm theo 4 tiêu chí", "Nhận xét ngắn gọn", "Gợi ý phiên bản tốt hơn", "Danh sách việc cần luyện lại"]
  }
] as const;

export const guidePageStages = [
  {
    number: "01",
    title: "Chuẩn bị hồ sơ nền",
    description: "Tạo hồ sơ cá nhân với ngành học, trường mục tiêu, học bổng, kinh nghiệm nổi bật và ngôn ngữ muốn luyện.",
    output: "Một bối cảnh nộp hồ sơ đủ rõ để AI tạo câu hỏi sát hồ sơ."
  },
  {
    number: "02",
    title: "Tạo phiên phỏng vấn",
    description: "Chọn số câu, mức khó và trọng tâm cần luyện như giới thiệu bản thân, kế hoạch học tập hoặc kế hoạch nghề nghiệp.",
    output: "Một phòng luyện có câu hỏi được sắp theo mạch hỏi đáp."
  },
  {
    number: "03",
    title: "Trả lời như buổi thật",
    description: "Trả lời từng câu bằng văn bản hoặc giọng nói. Giữ câu trả lời ngắn gọn, có luận điểm, ví dụ và kết luận rõ.",
    output: "Bộ câu trả lời có thể xem lại sau khi kết thúc phiên."
  },
  {
    number: "04",
    title: "Đọc phản hồi và luyện lại",
    description: "Xem điểm, nhận xét, câu trả lời mẫu và điểm yếu lặp lại. Sau đó tạo phiên mới tập trung vào phần còn yếu.",
    output: "Kế hoạch sửa câu trả lời trước buổi phỏng vấn thật."
  }
] as const;

export const pricingNotes = [
  "Gói miễn phí phù hợp để thử luồng tạo phòng và nhận phản hồi cơ bản.",
  "Gói cá nhân hướng đến người cần luyện đều nhiều phiên trước lịch phỏng vấn.",
  "Gói trung tâm dành cho mentor cần quản lý câu hỏi, học viên và báo cáo luyện tập."
] as const;

export const faqs = [
  {
    question: "Có luyện được bằng tiếng Trung không?",
    answer: "Có. Bạn có thể luyện bằng tiếng Trung, tiếng Việt hoặc tiếng Anh; chế độ song ngữ hỗ trợ người mới luyện tiếng Trung."
  },
  {
    question: "Câu hỏi có theo trường và ngành không?",
    answer: "Có. Phòng phỏng vấn dùng thông tin hồ sơ nộp để tạo câu hỏi liên quan đến trường, ngành, học bổng và kế hoạch học tập."
  },
  {
    question: "Có phản hồi sau từng câu trả lời không?",
    answer: "Có. Sau mỗi câu trả lời, hệ thống đưa nhận xét, điểm số và gợi ý cách trả lời rõ hơn."
  },
  {
    question: "Dữ liệu luyện tập có được lưu lại không?",
    answer: "Có. Lịch sử phỏng vấn lưu câu trả lời, điểm số và báo cáo để bạn theo dõi tiến bộ."
  }
] as const;
