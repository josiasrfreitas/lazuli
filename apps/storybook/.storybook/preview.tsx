import "./globals.css";

import type { Preview } from "@storybook/nextjs";

const preview: Preview = {
  globalTypes: {
    theme: {
      defaultValue: "light",
      description: "Tema",
      toolbar: {
        icon: "mirror",
        items: [
          { title: "Claro", value: "light" },
          { title: "Escuro", value: "dark" },
        ],
        title: "Tema",
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
