import type { Metadata } from "next";
import type { ReactNode } from "react";

import { THEME_BOOTSTRAP } from "~/lib/theme";

import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Lazuli",
  title: {
    default: "Lazuli | Gestão escolar",
    template: "%s | Lazuli",
  },
  description: "A rotina da escola em um só lugar: alunos, turmas, professores e financeiro.",
  icons: {
    icon: [
      {
        url: "/brand/lazuli-symbol-small-mono-navy.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/lazuli-symbol-small-mono-white.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
