import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@lazuli/ui/styles.css";

export const metadata: Metadata = {
  title: "Lazuli — Gestão Escolar",
  description: "Sistema de gestão de alunos, frequência e financeiro.",
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
