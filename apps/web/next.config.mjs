const DEFAULT_IMAGE_QUALITY = 75;
const LOGIN_IMAGE_QUALITY = 90;

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  // Keep the floating development badge from covering mobile account controls.
  devIndicators: false,
  serverExternalPackages: ["@hatchet-dev/typescript-sdk"],
  allowedDevOrigins: ["*.lazuli.localhost"],
  async headers() {
    return [
      {
        source: "/login",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/cadastrar-senha",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/api/auth/reset-password/:token",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  images: {
    qualities: [DEFAULT_IMAGE_QUALITY, LOGIN_IMAGE_QUALITY],
  },
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
    "@lazuli/integrations",
    "@lazuli/storage",
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
