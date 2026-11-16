import { createJobNotifier } from "./job-toast";

const PROCESSING_STALE_MS = 300_000;
type FileJobState =
  | "UPLOADING"
  | "WAITING"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "REJECTED"
  | "STALE";
type FileStateInput = { status: string; updatedAt?: Date | undefined };
const notifier = createJobNotifier();
const failures = new Set<FileJobState>(["FAILED", "REJECTED", "STALE"]);
const titles: Record<FileJobState, string> = {
  UPLOADING: "Arquivo a caminho. Segura aí…",
  WAITING: "Recebido! Já entrou na fila.",
  PROCESSING: "Conferindo o arquivo. Um instante…",
  READY: "Tudo certo. Arquivo na mão!",
  FAILED: "O arquivo tropeçou no caminho. Vamos de novo?",
  REJECTED: "Esse arquivo não passou na conferência.",
  STALE: "Esse processamento está demorando demais.",
};

export function isFileProcessingStale(file: FileStateInput): boolean {
  return Boolean(
    file.updatedAt &&
    ["RECEIVED", "PROCESSING"].includes(file.status) &&
    Date.now() - file.updatedAt.getTime() > PROCESSING_STALE_MS,
  );
}
const fileStates = new Map<string, FileJobState>([
  ["READY", "READY"],
  ["done", "READY"],
  ["FAILED", "FAILED"],
  ["error", "FAILED"],
  ["INTERRUPTED", "FAILED"],
  ["REJECTED", "REJECTED"],
  ["PROCESSING", "PROCESSING"],
  ["working", "PROCESSING"],
  ["UPLOADING", "UPLOADING"],
]);
export function fileJobState(file: FileStateInput): FileJobState {
  if (isFileProcessingStale(file)) return "STALE";
  return fileStates.get(file.status) ?? "WAITING";
}
export function notifyFileJob(input: {
  key: string;
  state: FileJobState;
  label: string;
  retry?: (() => void) | undefined;
  start?: boolean;
}): void {
  if (!notifier.has(input.key) && input.state === "READY" && !input.start) return;
  let outcome: "working" | "success" | "error" = "working";
  if (failures.has(input.state)) outcome = "error";
  if (input.state === "READY") outcome = "success";
  notifier.notify({
    key: input.key,
    state: input.state,
    title: titles[input.state],
    outcome,
    description:
      input.state === "REJECTED" ? `${input.label} · Escolha outro arquivo.` : input.label,
    retry: input.retry
      ? () => {
          notifyFileJob({ ...input, state: "WAITING", retry: undefined });
          input.retry?.();
        }
      : undefined,
  });
}
export function documentToastKey(token: string, kind: string): string {
  return `document:${token}:${kind}`;
}
