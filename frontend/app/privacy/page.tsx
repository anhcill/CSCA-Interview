import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFrame, MarketingIntro } from "@/components/home/marketing-frame";

export const metadata: Metadata = {
  title: "Chính sách bảo mật | Moly Interview",
  description: "Chính sách thu thập, sử dụng và bảo vệ dữ liệu cá nhân trên Moly Interview."
};

const sections = [
  {
    title: "1. Thông tin chúng tôi thu thập",
    body: "Khi bạn đăng ký và sử dụng Moly Interview, hệ thống có thể lưu họ tên, email, số điện thoại, thông tin hồ sơ học tập, mục tiêu apply, câu trả lời phỏng vấn, bản ghi âm, điểm đánh giá, lịch sử luyện tập và dữ liệu kỹ thuật như thời gian đăng nhập, trình duyệt, địa chỉ IP."
  },
  {
    title: "2. Mục đích sử dụng dữ liệu",
    body: "Dữ liệu được dùng để tạo tài khoản, xác thực đăng nhập, cá nhân hóa câu hỏi phỏng vấn, lưu tiến độ luyện tập, tạo báo cáo, cải thiện chất lượng dịch vụ, hỗ trợ người dùng và bảo vệ hệ thống khỏi lạm dụng."
  },
  {
    title: "3. Dữ liệu AI và bên thứ ba",
    body: "Một số nội dung luyện tập có thể được gửi tới nhà cung cấp AI hoặc dịch vụ hạ tầng để xử lý câu hỏi, phân tích câu trả lời, chuyển giọng nói hoặc vận hành hệ thống. Chúng tôi chỉ gửi dữ liệu cần thiết cho mục đích cung cấp tính năng."
  },
  {
    title: "4. Lưu trữ và bảo mật",
    body: "Chúng tôi áp dụng các biện pháp hợp lý để bảo vệ dữ liệu, bao gồm kiểm soát truy cập, mã hóa kết nối và giới hạn quyền trong hệ thống. Tuy nhiên, không có phương thức truyền tải hoặc lưu trữ nào an toàn tuyệt đối."
  },
  {
    title: "5. Quyền của người dùng",
    body: "Bạn có thể yêu cầu xem, cập nhật hoặc xóa thông tin tài khoản trong phạm vi hệ thống hỗ trợ và quy định pháp luật áp dụng. Một số dữ liệu có thể được giữ lại trong thời gian cần thiết để bảo mật, sao lưu, kế toán hoặc xử lý tranh chấp."
  },
  {
    title: "6. Cookie và phiên đăng nhập",
    body: "Website có thể dùng token, cookie hoặc bộ nhớ trình duyệt để duy trì phiên đăng nhập, ghi nhớ tùy chọn và bảo vệ tài khoản. Bạn có thể xóa dữ liệu trình duyệt, nhưng một số tính năng đăng nhập có thể cần thiết lập lại."
  },
  {
    title: "7. Liên hệ",
    body: "Nếu có câu hỏi về quyền riêng tư hoặc muốn yêu cầu xử lý dữ liệu cá nhân, vui lòng liên hệ đội ngũ hỗ trợ qua email hoặc kênh liên hệ chính thức hiển thị trên website."
  }
];

export default function PrivacyPage() {
  return (
    <MarketingFrame>
      <MarketingIntro
        eyebrow="Bảo mật"
        title="Chính sách bảo mật Moly Interview"
        description="Chính sách này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu khi bạn luyện phỏng vấn trên hệ thống."
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
          <Link href="/terms" className="inline-flex min-h-11 items-center rounded-md border border-[#b91c1c] bg-white px-4 text-sm font-black text-[#b91c1c] transition hover:bg-[#fff7ed]">
            Xem Điều khoản sử dụng
          </Link>
          <Link href="/register" className="inline-flex min-h-11 items-center rounded-md bg-[#b91c1c] px-4 text-sm font-black text-white transition hover:bg-[#991b1b]">
            Đồng ý và đăng ký
          </Link>
        </div>
      </section>
    </MarketingFrame>
  );
}
