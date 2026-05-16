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
  async redirects() {
    return [
      // Founding-member demo booking — prospects click longrein.eu/demo
      // from outreach emails; we route them to Cal.eu without exposing
      // the Cal infra URL. 308 permanent so search + email clients cache it.
      {
        source: "/demo",
        destination: "https://cal.eu/longrein/demo",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
