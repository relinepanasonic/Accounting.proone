import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['pdf2json', '@react-pdf/renderer', '@napi-rs/canvas'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  }
};

export default nextConfig;
