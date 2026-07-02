import path from "node:path";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  output: "standalone",
  experimental: isDev ? {} : {
    optimizePackageImports: ["framer-motion", "lucide-react", "recharts"]
  },
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, ".."),
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
