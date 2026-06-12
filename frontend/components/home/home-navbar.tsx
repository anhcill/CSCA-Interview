import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";

const navLinks = [
  { href: "/features", label: "Tính năng" },
  { href: "/guide", label: "Quy trình" },
  { href: "/pricing", label: "Gói sử dụng" }
] as const;

export function BrandLogo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 text-base font-black sm:text-lg ${light ? "text-white" : "text-[#111827]"}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#b91c1c] text-[#fde68a] shadow-sm shadow-red-900/15">
        <Bot size={20} />
      </span>
      InterviewAI
    </Link>
  );
}

export function HomeNavbar() {
  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-4">
        <BrandLogo />

        <nav className="hidden items-center gap-8 text-sm font-bold text-[#4b5563] md:flex">
          {navLinks.map((item) => (
            <Link key={item.href} className="transition hover:text-[#b91c1c]" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-[#d8e0eb] bg-white px-3 text-sm font-bold text-[#172033] shadow-sm transition hover:border-[#b91c1c] sm:px-4"
        >
          Đăng nhập
        </Link>
        <Link
          href="/register"
          className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#b91c1c] px-3 text-sm font-black text-white shadow-sm shadow-red-900/15 transition hover:bg-[#991b1b] sm:px-4"
        >
            Đăng ký
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <nav className="grid grid-cols-3 gap-2 text-center text-xs font-black text-[#4b5563] md:hidden">
        {navLinks.map((item) => (
          <Link key={item.href} className="rounded-md border border-[#dde5ef] bg-white px-2 py-2 transition hover:border-[#b91c1c] hover:text-[#b91c1c]" href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
