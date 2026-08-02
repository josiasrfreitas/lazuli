import "./globals.css";

import type { Preview } from "@storybook/nextjs";

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className="grid min-h-svh place-items-center p-6">
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
