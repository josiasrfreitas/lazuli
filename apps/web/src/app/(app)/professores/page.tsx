import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TeachersPage } from "~/features/teachers/teachers-page";

export const metadata: Metadata = { title: "Professores" };

export default function TeachersRoute(): ReactElement {
  return <TeachersPage />;
}
