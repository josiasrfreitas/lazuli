import type { Metadata } from "next";
import type { ReactNode } from "react";

import { StudentsPage } from "~/features/students/students-page";

export const metadata: Metadata = { title: "Alunos" };

export default function AlunosRoute(): ReactNode {
  return <StudentsPage />;
}
