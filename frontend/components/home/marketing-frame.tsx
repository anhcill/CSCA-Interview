import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HideOnScrollHeader } from "@/components/hide-on-scroll-header";
import { HomeFooter } from "./home-footer";
import { HomeNavbar } from "./home-navbar";

type MarketingFrameProps = {
  children: ReactNode;
};

type MarketingIntroProps = {
  description: string;
  eyebrow: string;
  primaryHref?: string;
  primaryLabel?: string;
  title: string;
};

export function MarketingFrame({ children }: MarketingFrameProps) {
  return (
    <main id="main-content" className="min-h-screen bg-[#f6f8fb] font-sans text-[#172033]">
      <HideOnScrollHeader className="sticky top-0 z-40 border-b border-[#ead8c2] bg-white/88 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <HomeNavbar />
        </div>
      </HideOnScrollHeader>
      {children}
      <HomeFooter />
    </main>
  );
}

export function MarketingIntro({
  description,
  eyebrow,
  primaryHref = "/register",
  primaryLabel = "Bắt đầu miễn phí",
  title
}: MarketingIntroProps) {
  return (
    <section className="relative overflow-hidden border-b border-[#ead8c2] bg-white px-4 py-16 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(185,28,28,0.12),transparent_24rem),radial-gradient(circle_at_72%_78%,rgba(245,158,11,0.16),transparent_22rem)]" />
      <div className="absolute right-8 top-8 hidden rounded-lg border border-[#f1c36d] bg-white/72 px-4 py-3 text-2xl font-black text-[#b91c1c] shadow-sm md:block">
        留学
      </div>
      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-black uppercase text-[#b91c1c]">{eyebrow}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[0.82fr_0.18fr] lg:items-end">
          <div>
            <h1 className="max-w-4xl text-4xl font-black leading-tight text-[#111827] sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-[#4b5563] sm:text-lg">{description}</p>
          </div>
          <Link
            href={primaryHref}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-md bg-[#b91c1c] px-5 text-sm font-black text-white shadow-lg shadow-red-900/15 transition hover:bg-[#991b1b]"
          >
            {primaryLabel}
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
