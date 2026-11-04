import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@melo/core"],
  poweredByHeader: false,
  // Fonts read from disk by the share-image routes.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**"] },
};

export default nextConfig;
