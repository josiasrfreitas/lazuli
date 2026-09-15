import { createConfig } from "@lazuli/eslint-config/base";
import { plugin as shadcn } from "@shadcn/lint";

export default [
  ...createConfig({ packageType: "web", tsconfigRootDir: import.meta.dirname }),
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: { shadcn },
    settings: {
      shadcn: {
        componentImports: ["^@lazuli/ui(/|$)"],
        note: "See docs/frontend/README.md for Lazuli design-system policy and exceptions.",
      },
    },
    rules: {
      "shadcn/no-arbitrary-values": "warn",
      "shadcn/no-inline-styles": "error",
      "shadcn/no-raw-colors": "warn",
      "shadcn/no-restyle": [
        "warn",
        {
          allow: ["layout"],
          message: {
            color:
              "Use an existing Lazuli variant or semantic token; add a shared variant only for repeated visual intent.",
            shape:
              "Use the component's existing size or variant; shape belongs to the shared primitive.",
            spacing:
              "Use a component size for internal spacing, or margin/gap on the surrounding layout.",
            typography:
              "Use the component's existing variant; typography belongs to the shared primitive.",
          },
        },
      ],
      "shadcn/no-unknown-classes": "warn",
      "shadcn/require-static-classes": "warn",
    },
  },
];
