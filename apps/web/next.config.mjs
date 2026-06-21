/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  // Internal workspace packages are shipped as TypeScript source (T3 Turbo
  // "just-in-time" packages); Next transpiles them here.
  transpilePackages: ["@lazuli/api", "@lazuli/auth", "@lazuli/ui"],

  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};

export default config;
