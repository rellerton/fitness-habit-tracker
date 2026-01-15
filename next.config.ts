import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Key fix:
  // When set to ".", Next will generate relative asset URLs like:
  //   ./_next/static/...
  // which works under HA ingress token paths AND still works locally.
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || undefined,
};

export default nextConfig;
