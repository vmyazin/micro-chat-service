// apps/web/next.config.ts
import type { NextConfig } from "next";

const apiUrl = process.env.API_URL || 'http://localhost:8787';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
