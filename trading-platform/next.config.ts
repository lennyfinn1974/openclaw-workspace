import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "./"
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8101/api/:path*',
      },
    ]
  },
};

export default nextConfig;
