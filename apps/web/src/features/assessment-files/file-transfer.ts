const DOWNLOAD_URL_REVOKE_DELAY_MS = 1000;
export function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Não foi possível ler o arquivo. Selecione novamente."));
    reader.onabort = () => reject(new Error("A leitura foi interrompida. Tente novamente."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
    reader.readAsDataURL(file);
  });
}

export function downloadFileBase64(file: {
  base64: string;
  contentType: string;
  fileName: string;
}): void {
  const bytes = Uint8Array.from(atob(file.base64), (char) => char.codePointAt(0)!);
  const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_REVOKE_DELAY_MS);
}
