import Link from "next/link";
import { BrandLogo } from "./home-navbar";

export function HomeFooter() {
  return (
    <footer className="bg-[#f6f8fb] px-4 py-10 text-[#172033] sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 border-t border-[#dde5ef] pt-8 md:flex-row">
        <div>
          <BrandLogo />
          <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-[#4b5563]">
            Nền tảng luyện phỏng vấn học bổng Trung Quốc bằng AI, tập trung vào hồ sơ apply, mạch hỏi thật và phản hồi có thể hành động.
          </p>
        </div>

        <div className="grid gap-8 text-sm font-bold sm:grid-cols-3">
          <FooterGroup title="Sản phẩm" links={[["Tính năng", "/features"], ["Quy trình", "/guide"], ["Gói sử dụng", "/pricing"]]} />
          <FooterGroup title="Tài khoản" links={[["Đăng nhập", "/login"], ["Đăng ký", "/register"]]} />
          <div className="space-y-3">
            <p className="font-black text-[#111827]">Liên hệ</p>
            <p className="text-[#4b5563]">support@interviewai.vn</p>
            <p className="text-[#4b5563]">TP. Hồ Chí Minh</p>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-7xl text-xs font-semibold text-[#6b7280]">© 2026 InterviewAI. All rights reserved.</p>
    </footer>
  );
}

function FooterGroup({ links, title }: { links: Array<[string, string]>; title: string }) {
  return (
    <div className="space-y-3">
      <p className="font-black text-[#111827]">{title}</p>
      {links.map(([label, href]) => (
        <Link key={href} className="block text-[#4b5563] transition hover:text-[#b91c1c]" href={href}>
          {label}
        </Link>
      ))}
    </div>
  );
}
