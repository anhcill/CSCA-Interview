import { HomeFooter } from "./home-footer";
import { HomeHero } from "./home-hero";
import { HomeNavbar } from "./home-navbar";
import {
  AudienceSection,
  ChinaPathSection,
  CtaSection,
  DetailFeaturesSection,
  FaqSection,
  GuideSection,
  InterviewPreviewSection,
  PricingSection,
  ScholarshipFocusSection,
  StatsSection
} from "./home-sections";

export function HomePage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#f6f8fb] font-sans text-[#172033]">
      <div className="sticky top-0 z-40 border-b border-[#ead8c2] bg-white/88 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <HomeNavbar />
        </div>
      </div>
      <HomeHero />
      <StatsSection />
      <ChinaPathSection />
      <AudienceSection />
      <DetailFeaturesSection />
      <InterviewPreviewSection />
      <GuideSection />
      <ScholarshipFocusSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <HomeFooter />
    </main>
  );
}
