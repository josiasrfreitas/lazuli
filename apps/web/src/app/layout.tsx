import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Lazuli — Gestão Escolar",
  description: "Sistema de gestão de alunos, frequência e financeiro.",
};

/** The product ships dark-only for now; the light tokens stay for a later theme switch. */
export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
