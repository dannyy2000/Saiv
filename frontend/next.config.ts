import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
    const base = backend.replace(/\/$/, "");
    return [
      {
        // Proxy all browser requests under /api/* to your backend to avoid CORS
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
