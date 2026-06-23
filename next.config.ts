import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Lets oversized resume uploads reach /api/parse-resume so the route can
    // return its own clear 8 MB validation error instead of receiving a
    // proxy-truncated multipart body.
    proxyClientMaxBodySize: "32mb",
  },
};

export default nextConfig;
