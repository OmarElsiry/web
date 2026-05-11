import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Skip linting during build (already done in dev/CI)
  eslint: { ignoreDuringBuilds: true },
  // Skip type checking during build (already done in dev/CI)
  typescript: { ignoreBuildErrors: true },
  // Tree-shake large icon libraries
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
