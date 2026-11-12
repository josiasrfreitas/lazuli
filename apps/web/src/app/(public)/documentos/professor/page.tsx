import type { ReactElement } from "react";
import type { Metadata } from "next";
import { MobileUploadPage } from "~/features/mobile-upload/mobile-page";
import { TEACHER_UPLOAD_CATEGORIES } from "~/features/teachers/upload-categories";
export const metadata: Metadata = {
  title: "Enviar documentos do professor",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Page(): ReactElement {
  return (
    <MobileUploadPage endpoint="/api/teacher-capture" categories={TEACHER_UPLOAD_CATEGORIES} />
  );
}
