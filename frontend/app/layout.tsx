import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import Script from "next/script";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { createPageMetadata, getStructuredData } from "@/lib/seo";
import "./design-tokens.css";
import "./globals.css";

export const metadata: Metadata = createPageMetadata();

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const intlMessages = await getMessages();
  const structuredData = getStructuredData();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="strip-extension-hydration-attrs" strategy="beforeInteractive">
          {`
            (() => {
              const attrs = ["bis_skin_checked", "fdprocessedid"];
              const cleanNode = (node) => {
                if (node?.nodeType !== 1) return;
                attrs.forEach((attr) => {
                  if (node.hasAttribute?.(attr)) node.removeAttribute(attr);
                  node.querySelectorAll?.("[" + attr + "]").forEach((item) => item.removeAttribute(attr));
                });
              };
              const cleanAll = () => cleanNode(document.documentElement);
              cleanAll();
              const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                  cleanNode(mutation.target);
                  mutation.addedNodes?.forEach(cleanNode);
                }
              });
              observer.observe(document.documentElement, {
                attributeFilter: attrs,
                attributes: true,
                childList: true,
                subtree: true
              });
              window.addEventListener("load", () => window.setTimeout(() => observer.disconnect(), 3000), { once: true });
              document.addEventListener("DOMContentLoaded", cleanAll, { once: true });
            })();
          `}
        </Script>
        <script
          id="seo-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
          }}
        />
        <NextIntlClientProvider locale={locale} messages={intlMessages}>
          <ThemeProvider>
            <ToastProvider>
              <a href="#main-content" className="skip-link">Skip to content</a>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
