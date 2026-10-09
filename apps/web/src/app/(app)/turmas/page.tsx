import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ClassesPage } from "~/features/classes/classes-page";

export const metadata: Metadata = { title: "Turmas" };

export default function TurmasRoute(): ReactNode {
  return <ClassesPage />;
}
