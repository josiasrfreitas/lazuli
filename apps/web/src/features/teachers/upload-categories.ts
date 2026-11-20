import type { UploadCategory } from "~/features/mobile-upload/file-editor";
export const TEACHER_UPLOAD_CATEGORIES: UploadCategory[] = [
  { id: "PHOTO", label: "Foto do cadastro", photo: true },
  { id: "ID", label: "Identificação" },
  { id: "CONTRACT", label: "Contrato" },
  { id: "OTHER", label: "Outro documento", customLabel: true },
];
