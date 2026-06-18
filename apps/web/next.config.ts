import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/schemas'],
};

export default nextConfig;
