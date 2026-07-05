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
  "Moly Interview"
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
      canonical: path
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
      logo: absoluteUrl("/favicon.png")
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      alternateName: siteAlternateName,
      url,
      inLanguage: "vi-VN"
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteName,
      alternateName: siteAlternateName,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url,
      description: defaultDescription,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "VND"
      }
    }
  ];
}
