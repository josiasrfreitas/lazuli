import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AdmissionsPage } from "~/features/admissions/admissions-page";
export const metadata: Metadata = { title: "Interessados" };
export default function AdmissionsRoute(): ReactElement {
  return <AdmissionsPage />;
}
