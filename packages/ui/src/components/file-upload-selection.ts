import type { FileUploadSettings } from "./file-upload.types";
const KIB = 1024;
const MIB = KIB * KIB;
export function formatFileSize(bytes: number): string {
  if (bytes < KIB) return `${bytes} B`;
  const unit = bytes < MIB ? "KB" : "MB";
  const size = bytes / (unit === "KB" ? KIB : MIB);
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(size)} ${unit}`;
}
function acceptsFile(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  return accept.split(",").some((entry) => {
    const type = entry.trim().toLowerCase();
    if (type.startsWith(".")) return file.name.toLowerCase().endsWith(type);
    if (type.endsWith("/*")) return file.type.startsWith(type.slice(0, -1));
    return file.type === type;
  });
}
function invalidFile(file: File, settings: FileUploadSettings): string | null {
  if (file.size === 0) return `“${file.name}” está vazio. Escolha outro arquivo.`;
  if (!acceptsFile(file, settings.accept))
    return `“${file.name}” não está em um formato aceito. Use ${settings.acceptLabel}.`;
  if (file.size > settings.maxSize)
    return `“${file.name}” ultrapassa ${formatFileSize(settings.maxSize)}. Escolha um arquivo menor.`;
  return null;
}
function distinctFiles(files: File[]): File[] {
  return files.filter(
    (file, index) =>
      files.findIndex(
        (other) =>
          other.name === file.name &&
          other.size === file.size &&
          other.lastModified === file.lastModified,
      ) === index,
  );
}
export function incomingFileSelection(
  settings: FileUploadSettings,
  incoming: File[],
): { files: File[]; error: null } | { error: string } {
  if (!settings.multiple && incoming.length > 1) return { error: "Escolha um arquivo por vez." };
  for (const file of incoming) {
    const error = invalidFile(file, settings);
    if (error) return { error };
  }
  const next = settings.multiple ? distinctFiles([...settings.value, ...incoming]) : incoming;
  if (next.length > settings.maxFiles)
    return { error: `Selecione até ${settings.maxFiles} arquivos por envio.` };
  return { files: next, error: null };
}
