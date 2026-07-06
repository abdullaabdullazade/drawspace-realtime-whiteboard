import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Avoid eval-based source maps in dev so strict CSP / Brave Shields
  // don't block the app ("unsafe-eval" errors).
  webpack: (config, { dev }) => {
    if (dev) config.devtool = 'source-map';
    return config;
  },
};

export default nextConfig;
