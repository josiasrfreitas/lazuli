import type { ReactElement } from "react";
import type { Metadata } from "next";
import { DocumentMobilePage } from "~/features/student-documents/mobile-page";
export const metadata: Metadata = {
  title: "Documentos do cadastro",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Page(): ReactElement {
  return <DocumentMobilePage />;
}
