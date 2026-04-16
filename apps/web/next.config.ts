import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@west-santo/core", "@west-santo/data"],
};

export default nextConfig;
