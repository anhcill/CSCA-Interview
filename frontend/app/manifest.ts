import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moly Interview - Luyện phỏng vấn học bổng Trung Quốc bằng AI",
    short_name: "Moly Interview",
    description:
      "Moly Interview giúp ứng viên luyện phỏng vấn học bổng Trung Quốc bằng AI, tạo câu hỏi theo hồ sơ, chấm câu trả lời và gợi ý cải thiện.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8fb",
    theme_color: "#b91c1c",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    lang: "vi",
    icons: [
      {
        src: "/favicon.png",
        sizes: "any",
        type: "image/png"
      }
    ]
  };
}
