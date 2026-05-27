import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pg-native", "@neondatabase/serverless"],
};

export default nextConfig;
