import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright / curl often hit 127.0.0.1 while `next dev` binds as localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
