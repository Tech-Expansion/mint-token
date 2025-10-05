import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ensure ESLint warnings don't fail the Vercel build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Keep TypeScript errors as blocking by default (safer). Set to true if you need to bypass TS during build.
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
