export const interviewQuestions = [
  {
    zh: "请介绍一下你自己。",
    vi: "Bạn hãy giới thiệu bản thân.",
    category: "Cá nhân"
  },
  {
    zh: "你为什么选择我们学校和这个专业？",
    vi: "Vì sao bạn chọn trường và ngành này?",
    category: "Trường/ngành"
  },
  {
    zh: "你未来的学习计划是什么？",
    vi: "Kế hoạch học tập tương lai của bạn là gì?",
    category: "Study plan"
  },
  {
    zh: "你为什么申请这个奖学金？",
    vi: "Vì sao bạn muốn ứng tuyển học bổng này?",
    category: "Học bổng"
  },
  {
    zh: "毕业以后你有什么职业规划？",
    vi: "Sau khi tốt nghiệp bạn có định hướng nghề nghiệp thế nào?",
    category: "Nghề nghiệp"
  },
  {
    zh: "如果遇到语言困难，你会怎么解决？",
    vi: "Nếu gặp khó khăn ngôn ngữ, bạn sẽ xử lý ra sao?",
    category: "Tình huống"
  },
  {
    zh: "你对中国文化有什么了解？",
    vi: "Bạn hiểu gì về văn hóa Trung Quốc?",
    category: "Ngôn ngữ"
  },
  {
    zh: "请说一个你克服困难的经历。",
    vi: "Hãy kể một trải nghiệm bạn vượt qua khó khăn.",
    category: "Tình huống"
  },
  {
    zh: "你的优势和不足是什么？",
    vi: "Điểm mạnh và điểm cần cải thiện của bạn là gì?",
    category: "Cá nhân"
  },
  {
    zh: "你希望通过留学获得什么？",
    vi: "Bạn mong muốn đạt được điều gì thông qua du học?",
    category: "Mục tiêu"
  }
] as const;

export type ChatMessage = {
  id: number;
  author: "ai" | "user";
  content: string;
  time: string;
  translation?: string;
};

export const initialMessages: ChatMessage[] = [
  {
    id: 1,
    author: "ai",
    content: "请介绍一下你自己。",
    translation: "Bạn hãy giới thiệu bản thân.",
    time: "10:30"
  },
  {
    id: 2,
    author: "user",
    content: "我叫阮文A，来自越南。我2021年毕业于河内大学...",
    translation: "Tôi là Nguyễn Văn A, đến từ Việt Nam...",
    time: "10:31"
  },
  {
    id: 3,
    author: "ai",
    content: "你为什么选择我们学校和这个专业？",
    time: "10:32"
  },
  {
    id: 4,
    author: "user",
    content: "我选择贵校是因为...",
    translation: "Em chọn trường vì...",
    time: "10:33"
  },
  {
    id: 5,
    author: "ai",
    content: "你未来的学习计划是什么？",
    time: "10:34"
  }
];
