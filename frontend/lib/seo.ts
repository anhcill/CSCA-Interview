import type { Metadata, MetadataRoute } from "next";

const productionSiteUrl = "https://molyinterview.online";
const localSiteUrl = "http://localhost:3010";

export const siteName = "Moly Interview";
export const siteAlternateName = "AI Phỏng Vấn Du Học";
export const defaultTitle = "Moly Interview | Luyện phỏng vấn học bổng Trung Quốc bằng AI";
export const defaultDescription =
  "Moly Interview giúp ứng viên luyện phỏng vấn học bổng Trung Quốc bằng AI, tạo câu hỏi theo hồ sơ, chấm câu trả lời và gợi ý cải thiện.";
export const defaultOgImage = "/home/hero-interview.png";

export const publicSitemapRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" },
  { path: "/guide", priority: 0.85, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.25, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.25, changeFrequency: "yearly" }
] as const satisfies ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}>;

const keywords = [
  "luyện phỏng vấn du học",
  "phỏng vấn học bổng Trung Quốc",
  "học bổng CSC",
  "AI phỏng vấn",
  "Chinese scholarship interview",
  "Moly Interview",
  "luyện phỏng vấn CSC",
  "học bổng chính phủ Trung Quốc",
  "CSC scholarship interview practice",
  "中国政府奖学金面试",
  "phỏng vấn du học Trung Quốc AI",
  "mô phỏng phỏng vấn học bổng",
  "Chinese government scholarship",
  "interview preparation AI",
  "phỏng vấn tuyển sinh đại học Trung Quốc",
  "mock interview du học",
  "luyện phỏng vấn trực tuyến",
  "scholarship interview tips",
  "phỏng vấn học bổng toàn phần",
  "AI面试练习"
];

function normalizeSiteUrl(value: string | undefined) {
  const fallback = process.env.NODE_ENV === "production" ? productionSiteUrl : localSiteUrl;
  const rawValue = value?.trim() || fallback;

  try {
    return new URL(rawValue).origin;
  } catch {
    return fallback;
  }
}

export function getSiteUrl() {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.FRONTEND_URL);
}

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function privateRouteMetadata(title = siteName): Metadata {
  return {
    title,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true
      }
    }
  };
}

export function createPageMetadata({
  title = defaultTitle,
  description = defaultDescription,
  path = "/",
  noIndex = false
}: {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
} = {}): Metadata {
  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    description,
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
      apple: "/favicon.png"
    },
    applicationName: siteName,
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    keywords,
    category: "education",
    alternates: {
      canonical: path,
      languages: {
        "vi-VN": path,
        "en-US": path,
        "zh-CN": path,
        "x-default": path
      }
    },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      alternateLocale: ["en_US", "zh_CN"],
      url: path,
      siteName,
      title,
      description,
      images: [
        {
          url: defaultOgImage,
          width: 1200,
          height: 630,
          alt: "Moly Interview - luyện phỏng vấn học bổng Trung Quốc bằng AI"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [defaultOgImage]
    },
    robots: noIndex
      ? privateRouteMetadata(title).robots
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1
          }
        },
    ...(googleVerification ? { verification: { google: googleVerification } } : {})
  };
}

export function getStructuredData() {
  const url = getSiteUrl();

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteName,
      alternateName: siteAlternateName,
      url,
      logo: absoluteUrl("/favicon.png"),
      description: defaultDescription,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "support@interviewai.vn",
        availableLanguage: ["Vietnamese", "Chinese", "English"]
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      alternateName: siteAlternateName,
      url,
      inLanguage: "vi-VN",
      potentialAction: {
        "@type": "SearchAction",
        target: `${url}/features?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteName,
      alternateName: siteAlternateName,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web Browser",
      url,
      description: defaultDescription,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        "ratingCount": "128",
        "bestRating": "5",
        "worstRating": "1"
      },
      featureList: [
        "Tạo câu hỏi phỏng vấn theo hồ sơ học bổng Trung Quốc (CSC)",
        "Phân tích câu trả lời và chấm điểm tự động bằng AI",
        "Luyện phỏng vấn song ngữ Trung - Việt - Anh",
        "Báo cáo chi tiết điểm yếu và gợi ý sửa từng câu"
      ],
      offers: [
        {
          "@type": "Offer",
          price: "0",
          priceCurrency: "VND",
          name: "Gói Dùng thử Miễn phí"
        }
      ]
    }
  ];
}

export function getFAQStructuredData(faqs: ReadonlyArray<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
  };
}

export function getHowToStructuredData(
  name: string,
  description: string,
  steps: ReadonlyArray<{ title: string; description: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.description
    }))
  };
}

export function getBreadcrumbStructuredData(
  items: ReadonlyArray<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}
