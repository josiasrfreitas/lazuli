export type PendingFile = {
  id: string;
  progressId: string;
  phase: "BLOCK_ONE" | "BLOCK_TWO" | "RECOVERY";
  competence?: "WRITTEN" | "LISTENING";
  appointmentId?: string;
  file: File;
  createdAt: number;
};
async function database(userId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`lazuli-proof-uploads:${userId}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.addEventListener("error", () =>
      reject(
        new Error(
          "Não foi possível guardar o arquivo neste navegador. Libere espaço e tente novamente.",
        ),
      ),
    );
  });
}
export async function readPendingFiles(userId: string): Promise<PendingFile[]> {
  const db = await database(userId);
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("files").objectStore("files").getAll();
      request.onsuccess = () => resolve(request.result as PendingFile[]);
      request.addEventListener("error", () =>
        reject(request.error ?? new Error("Não foi possível recuperar a fila de envios.")),
      );
    });
  } finally {
    db.close();
  }
}
export async function storePendingFile(userId: string, file: PendingFile): Promise<void> {
  const db = await database(userId);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      transaction.objectStore("files").put(file);
      transaction.oncomplete = () => resolve();
      transaction.addEventListener("error", () =>
        reject(new Error("Sem espaço para guardar o envio. Libere espaço no navegador.")),
      );
      transaction.addEventListener("abort", () =>
        reject(transaction.error ?? new Error("O armazenamento do envio foi interrompido.")),
      );
    });
  } finally {
    db.close();
  }
}
export async function removePendingFile(userId: string, id: string): Promise<void> {
  const db = await database(userId);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      transaction.objectStore("files").delete(id);
      transaction.oncomplete = () => resolve();
      transaction.addEventListener("error", () =>
        reject(transaction.error ?? new Error("Não foi possível remover o envio local.")),
      );
      transaction.addEventListener("abort", () =>
        reject(transaction.error ?? new Error("A remoção do envio foi interrompida.")),
      );
    });
  } finally {
    db.close();
  }
}

const COMPLETE_PERCENT = 100;
const HTTP_OK = 200;
const HTTP_REDIRECT = 300;
type Transfer = { request: XMLHttpRequest; completed: Promise<void> };
export function transferFile(item: PendingFile, onProgress: (value: number) => void): Transfer {
  const request = new XMLHttpRequest();
  const completed = new Promise<void>((resolve, reject) => {
    request.open("POST", "/api/assessment-files");
    request.timeout = 300_000;
    request.setRequestHeader("Content-Type", item.file.type);
    request.setRequestHeader(
      "x-upload-metadata",
      encodeURIComponent(
        JSON.stringify({
          id: item.id,
          progressId: item.progressId,
          phase: item.phase,
          competence: item.competence,
          appointmentId: item.appointmentId,
          fileName: item.file.name,
          contentType: item.file.type,
          byteLength: item.file.size,
        }),
      ),
    );
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * COMPLETE_PERCENT));
    });
    request.addEventListener("load", () => {
      if (request.status >= HTTP_OK && request.status < HTTP_REDIRECT) resolve();
      else {
        let message = "Não foi possível receber o arquivo. Tente novamente.";
        try {
          const parsed = JSON.parse(request.responseText) as { message?: string };
          message = typeof parsed.message === "string" ? parsed.message : message;
        } catch {
          /* Keep the safe default. */
        }
        reject(new Error(message));
      }
    });
    const interrupted = (): void =>
      reject(new Error("Envio interrompido. Retome quando a conexão estiver disponível."));
    request.addEventListener("error", interrupted);
    request.addEventListener("timeout", interrupted);
    request.addEventListener("abort", interrupted);
    request.send(item.file);
  });
  return { request, completed };
}
