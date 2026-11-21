import type { UploadCategory } from "~/features/mobile-upload/file-editor";
export const TEACHER_UPLOAD_CATEGORIES: UploadCategory[] = [
  { id: "PHOTO", label: "Foto do cadastro", photo: true },
  { id: "ID", label: "Identificação", subtitle: "RG ou CIN · frente e verso" },
  { id: "CONTRACT", label: "Contrato", subtitle: "Documento do vínculo com a escola" },
  { id: "OTHER", label: "Outro documento", customLabel: true },
];
