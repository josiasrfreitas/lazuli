import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ClassesPage } from "~/features/classes/classes-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Turmas" };

export default async function TurmasRoute(): Promise<ReactNode> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <ClassesPage />;
}
