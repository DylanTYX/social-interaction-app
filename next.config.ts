import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/simulate/report",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
