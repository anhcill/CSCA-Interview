import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "Googlebot",
        allow: ["/"],
        disallow: [
          "/admin/",
          "/dashboard/",
          "/interview/",
          "/notifications/",
          "/profile/",
          "/login",
          "/register",
          "/api/",
          "/_next/",
          "/403-forbidden"
        ]
      },
      {
        userAgent: "Bingbot",
        allow: ["/"],
        disallow: [
          "/admin/",
          "/dashboard/",
          "/interview/",
          "/notifications/",
          "/profile/",
          "/login",
          "/register",
          "/api/",
          "/_next/",
          "/403-forbidden"
        ]
      },
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/admin/",
          "/dashboard/",
          "/interview/",
          "/notifications/",
          "/profile/",
          "/login",
          "/register",
          "/api/",
          "/_next/",
          "/403-forbidden"
        ]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
