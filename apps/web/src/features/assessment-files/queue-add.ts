import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from "@lazuli/validators";
import { storePendingFile, type PendingFile } from "./local-queue";
import type { QueueItemsSetter, UploadContextValue } from "./queue-model";
function assertFiles(files: File[]): void {
  for (const file of files) {
    if (
      file.size === 0 ||
      file.size > MAX_UPLOAD_FILE_BYTES ||
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
    )
      throw new Error(`Escolha fotos JPG/PNG ou PDFs de até ${MAX_UPLOAD_FILE_MB} MB cada.`);
  }
}
export function queueAdd({
  hydrated,
  userId,
  setItems,
}: {
  hydrated: boolean;
  userId: string;
  setItems: QueueItemsSetter;
}): UploadContextValue["add"] {
  return async (files, target) => {
    if (!hydrated) throw new Error("Aguarde a recuperação dos envios anteriores.");
    assertFiles(files);
    for (const file of files) {
      const pending: PendingFile = {
        ...target,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        file,
      };
      await storePendingFile(userId, pending);
      setItems((current) => [
        ...current,
        { id: pending.id, name: file.name, status: "QUEUED", progress: 0, pending },
      ]);
    }
  };
}
