import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@melo/core"],
  poweredByHeader: false,
};

export default nextConfig;
