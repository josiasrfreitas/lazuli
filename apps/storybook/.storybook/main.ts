import path from "node:path";

import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: {
    name: "@storybook/nextjs",
    options: {
      nextConfigPath: path.resolve(import.meta.dirname, "../../web/next.config.mjs"),
    },
  },
};

export default config;
