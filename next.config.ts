// Set Nepal Standard Time (UTC+5:45) as the server timezone
// This must be set before any module that uses dates is loaded
process.env.TZ = 'Asia/Kathmandu';

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
