import type { NextConfig } from 'next';

// Keys live in the monorepo root .env so the CLIs and the web app share one file.
try {
  process.loadEnvFile('../../.env');
} catch {
  // no .env: everything except private completions still works
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Intel DCAP quote verification ships WASM and must load from node_modules at runtime.
  serverExternalPackages: ['@phala/dcap-qvl'],
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};

export default nextConfig;
