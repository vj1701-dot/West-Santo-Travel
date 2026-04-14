import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@west-santo/core", "@west-santo/data"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
