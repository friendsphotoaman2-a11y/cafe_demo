import type { NextConfig } from "next";

// Optional Multi-Zone / Base Path configuration
const rawBasePath =
  process.env.CAFE_DEMO_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH;

const basePath =
  rawBasePath && rawBasePath.trim() && rawBasePath.trim() !== "/"
    ? ("/" + rawBasePath.trim().replace(/^\/+|\/+$/g, "")).replace(/\/+$/, "")
    : undefined;

// Multi-Zone Asset Prefix (used when basePath is active)
const rawAssetPrefix = process.env.CAFE_DEMO_ASSET_PREFIX;
const assetPrefix = basePath
  ? rawAssetPrefix && rawAssetPrefix.trim()
    ? ("/" + rawAssetPrefix.trim().replace(/^\/+|\/+$/g, "")).replace(/\/+$/, "")
    : "/cafe-static"
  : undefined;

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  ...(assetPrefix ? { assetPrefix } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath || "",
    NEXT_PUBLIC_ASSET_PREFIX: assetPrefix || "",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
