/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  allowedDevOrigins: ["*.lazuli.localhost"],
  experimental: {
    useTypeScriptCli: true,
    cpus: 2,
  },

  // Internal workspace packages are shipped as TypeScript source (T3 Turbo
  // "just-in-time" packages); Next transpiles them here.
  // Include transitive source packages too: Turbopack's TypeScript resolution
  // maps their NodeNext-style .js imports to the corresponding .ts/.tsx files.
  transpilePackages: [
    "@lazuli/api",
    "@lazuli/auth",
    "@lazuli/db",
    "@lazuli/domain",
    "@lazuli/job-contracts",
    "@lazuli/ui",
    "@lazuli/validators",
  ],
  turbopack: {},

  typescript: {
    // The build script generates route types and runs tsc with tsconfig.json
    // before compilation. Avoid checking the resolver-only NodeNext config.
    ignoreBuildErrors: true,
    // Turbopack 16.2 resolves .js imports to TypeScript only in NodeNext mode.
    tsconfigPath: "tsconfig.turbopack.json",
  },
};

export default config;
