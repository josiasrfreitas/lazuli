/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  allowedDevOrigins: ["*.lazuli.localhost"],
  experimental: {
    useTypeScriptCli: true,
  },

  // Internal workspace packages are shipped as TypeScript source (T3 Turbo
  // "just-in-time" packages); Next transpiles them here.
  transpilePackages: ["@lazuli/api", "@lazuli/auth", "@lazuli/db", "@lazuli/ui"],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };

    return webpackConfig;
  },

  typescript: { ignoreBuildErrors: false },
};

export default config;
