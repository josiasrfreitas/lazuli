import type { Metadata } from "next";
import type { ReactElement } from "react";
import { EmployeesPage } from "~/features/teachers/employees-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Colaboradores" };

export default async function EmployeesRoute(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <EmployeesPage />;
}
