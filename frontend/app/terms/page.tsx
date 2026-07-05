import Link from "next/link";
import { MarketingFrame, MarketingIntro } from "@/components/home/marketing-frame";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Điều khoản sử dụng | Moly Interview",
  description: "Điều khoản sử dụng dịch vụ luyện phỏng vấn Moly Interview.",
  path: "/terms"
});

const sections = [
  {
    title: "1. Phạm vi dịch vụ",
    body: "Moly Interview cung cấp công cụ luyện phỏng vấn, tạo câu hỏi, ghi nhận câu trả lời và gợi ý cải thiện hồ sơ. Nội dung trong hệ thống chỉ mang tính tham khảo, không bảo đảm kết quả học bổng, nhập học hoặc visa."
  },
  {
    title: "2. Tài khoản người dùng",
    body: "Bạn cần cung cấp thông tin chính xác khi đăng ký, tự bảo mật tài khoản và chịu trách nhiệm với mọi hoạt động phát sinh từ tài khoản của mình. Chúng tôi có thể tạm khóa tài khoản nếu phát hiện hành vi gian lận, spam, phá hoại hệ thống hoặc vi phạm pháp luật."
  },
  {
    title: "3. Dữ liệu và nội dung luyện tập",
    body: "Bạn chịu trách nhiệm với thông tin hồ sơ, câu trả lời, tệp tải lên và nội dung luyện tập đã cung cấp. Không nhập thông tin của người khác nếu chưa được phép, không gửi nội dung vi phạm pháp luật, xúc phạm, lừa đảo hoặc chứa mã độc."
  },
  {
    title: "4. Sử dụng AI",
    body: "Phản hồi do AI tạo có thể chưa chính xác hoặc chưa phù hợp với mọi trường hợp. Bạn cần tự kiểm tra, chỉnh sửa và tham khảo thêm cố vấn chuyên môn trước khi dùng cho hồ sơ chính thức."
  },
  {
    title: "5. Gói dịch vụ và thay đổi tính năng",
    body: "Các giới hạn lượt luyện, tính năng, giá và chính sách gói có thể thay đổi theo thời gian. Nếu có thay đổi quan trọng ảnh hưởng đến quyền lợi đang sử dụng, chúng tôi sẽ cố gắng thông báo trong hệ thống hoặc qua email."
  },
  {
    title: "6. Liên hệ",
    body: "Nếu có câu hỏi về điều khoản sử dụng, vui lòng liên hệ đội ngũ hỗ trợ qua email hoặc kênh liên hệ chính thức hiển thị trên website."
  }
];

export default function TermsPage() {
  return (
    <MarketingFrame>
      <MarketingIntro
        eyebrow="Điều khoản"
        title="Điều khoản sử dụng Moly Interview"
        description="Vui lòng đọc kỹ các điều khoản dưới đây trước khi tạo tài khoản và sử dụng dịch vụ luyện phỏng vấn."
        primaryHref="/register"
        primaryLabel="Quay lại đăng ký"
      />

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <div className="space-y-5">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-[#dde5ef] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-[#111827]">{section.title}</h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-[#4b5563]">{section.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/privacy" className="inline-flex min-h-11 items-center rounded-md border border-[#b91c1c] bg-white px-4 text-sm font-black text-[#b91c1c] transition hover:bg-[#fff7ed]">
            Xem Chính sách bảo mật
          </Link>
          <Link href="/register" className="inline-flex min-h-11 items-center rounded-md bg-[#b91c1c] px-4 text-sm font-black text-white transition hover:bg-[#991b1b]">
            Đồng ý và đăng ký
          </Link>
        </div>
      </section>
    </MarketingFrame>
  );
}
