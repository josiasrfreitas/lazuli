import "./globals.css";

import type { Preview } from "@storybook/nextjs";
import type { ReactElement, ReactNode } from "react";
import { useEffect } from "react";

function ThemeRoot({
  children,
  theme,
}: {
  children: ReactNode;
  theme: "dark" | "light";
}): ReactElement {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);

    return () => root.classList.remove(theme);
  }, [theme]);

  return (
    <div className={`${theme} grid min-h-svh place-items-center bg-background p-6 text-foreground`}>
      {children}
    </div>
  );
}

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
    (Story, context) => {
      const theme = context.globals.theme === "dark" ? "dark" : "light";

      return (
        <ThemeRoot theme={theme}>
          <Story />
        </ThemeRoot>
      );
    },
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
