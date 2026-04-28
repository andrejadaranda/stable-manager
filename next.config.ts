import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      // Allow Supabase Storage public URLs
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
