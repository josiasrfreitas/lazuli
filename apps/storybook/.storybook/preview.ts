import "@lazuli/ui/styles.css";

import type { Preview } from "@storybook/nextjs";

const preview: Preview = {
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
