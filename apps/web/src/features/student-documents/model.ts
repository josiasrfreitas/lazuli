export const DOCUMENTS = [
  {
    id: "student",
    title: "Identidade do aluno",
    detail: "RG ou CIN · frente e verso",
    extracts: true,
  },
  {
    id: "guardian",
    title: "Identidade do responsável",
    detail: "Para aluno menor de idade · frente e verso",
    extracts: true,
  },
  {
    id: "residence",
    title: "Comprovante de residência",
    detail: "Foto do comprovante completo",
    extracts: false,
  },
  {
    id: "payment",
    title: "Pagamento da matrícula",
    detail: "Comprovante da taxa de matrícula",
    extracts: false,
  },
  {
    id: "photo",
    title: "Foto do aluno",
    detail: "Uma foto de rosto, nítida e bem iluminada",
    extracts: false,
  },
] as const;
// Registration collects identity and residence documents; payment belongs to finance.
export const ENROLLMENT_DOCUMENTS = DOCUMENTS.filter(
  (document) =>
    document.id === "student" || document.id === "guardian" || document.id === "residence",
);
export type DocumentKind = (typeof DOCUMENTS)[number]["id"];
export type DocumentDefinition = (typeof DOCUMENTS)[number];
export type DocumentJson =
  | string
  | number
  | boolean
  | null
  | readonly DocumentJson[]
  | { [key: string]: DocumentJson | undefined };
export type CapturedDocument = {
  status: string;
  revision: string;
  extraction?: DocumentJson;
  format?: "pdf" | "image";
};
export const DOCUMENT_ACCEPT = "image/jpeg,image/png,application/pdf";
export const DOCUMENT_ACCEPT_LABEL = "JPG, PNG ou PDF";
export const DOCUMENT_SIZE_LIMITS = { "application/pdf": 5_242_880 };
export const DOCUMENT_SIZE_LABEL = "imagens até 25 MB; PDF até 5 MB";
export type CaptureSession = {
  status: string;
  documents: Partial<Record<DocumentKind, CapturedDocument>>;
};
export async function captureRequest<T>(
  token: string,
  { path = "", options }: { path?: string; options?: RequestInit } = {},
): Promise<T> {
  const response = await fetch(`/api/student-documents${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options?.headers },
    cache: "no-store",
  });
  const result = (await response.json()) as T & { code?: string };
  if (!response.ok) throw new Error(result.code ?? "UNAVAILABLE");
  return result;
}
export function statusLabel(status?: string): string {
  if (status === "READY" || status === "done") return "Enviado";
  if (status === "FAILED" || status === "error") return "Recebido · leitura falhou";
  if (status === "RECEIVED" || status === "PROCESSING" || status === "working")
    return "Lendo os dados…";
  return "Aguardando envio";
}
