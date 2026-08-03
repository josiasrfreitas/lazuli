import "./globals.css";

import type { Preview } from "@storybook/nextjs";

const preview: Preview = {
  globalTypes: {
    theme: {
      defaultValue: "light",
      description: "Theme",
      toolbar: {
        icon: "mirror",
        items: [
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" },
        ],
        title: "Theme",
      },
    },
  },
  decorators: [
    (Story, context) => (
      <div
        className={
          context.globals.theme === "dark"
            ? "dark grid min-h-svh place-items-center bg-background p-6 text-foreground"
            : "light grid min-h-svh place-items-center bg-background p-6 text-foreground"
        }
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/iu,
        date: /Date$/u,
      },
    },
  },
};

export default preview;
