import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // pdf2json uses native Node.js binaries — must be external to prevent Turbopack bundling crash
  serverExternalPackages: ['pdf2json'],
};

export default nextConfig;
