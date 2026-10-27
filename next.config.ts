import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // The DICOM codecs (Emscripten) reference fs/path on their Node code path only: stub them in the browser
  turbopack: {
    resolveAlias: {
      fs: { browser: './src/lib/empty-module.ts' },
      path: { browser: './src/lib/empty-module.ts' },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = { ...(config.resolve.fallback ?? {}), fs: false, path: false };
    }
    return config;
  },
};

export default nextConfig;
