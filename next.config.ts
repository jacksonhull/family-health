import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — nodeMiddleware is supported but not yet in type definitions
    nodeMiddleware: true,
  },
};

export default nextConfig;
