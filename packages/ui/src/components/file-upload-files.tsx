import { useEffect, useState, type ReactElement } from "react";
import { Check, FileText, ImageIcon, X } from "lucide-react";
import { Button } from "./button";
import { formatFileSize } from "./file-upload-selection";
import type { FileUploadState } from "./file-upload-state";
type FileRowProps = { state: FileUploadState; file: File; index: number };
export function FileUploadFiles({ state }: { state: FileUploadState }): ReactElement {
  return (
    <ul className="file-upload__files" aria-label="Arquivos selecionados">
      {state.settings.value.map((file, index) => (
        <FileUploadRow
          key={`${file.name}-${file.size}-${file.lastModified}`}
          file={file}
          index={index}
          state={state}
        />
      ))}
    </ul>
  );
}
function FileUploadRow({ state, file, index }: FileRowProps): ReactElement {
  return (
    <li className="file-upload__file">
      <FilePreview file={file} />
      <div className="file-upload__file-details">
        <p className="file-upload__file-name">{file.name}</p>
        <p className="file-upload__hint">
          {formatFileSize(file.size)}
          {state.settings.status === "idle" && " · Pronto para enviar"}
        </p>
      </div>
      <FileRowAction state={state} file={file} index={index} />
    </li>
  );
}
function FileRowAction({ state, file, index }: FileRowProps): ReactElement | null {
  const { settings, reportValidation } = state;
  if (settings.status === "success")
    return <Check aria-hidden="true" className="file-upload__check" />;
  if (settings.status !== "idle") return null;
  return (
    <Button
      variant="ghost"
      size="icon-compact-responsive"
      disabled={settings.disabled}
      aria-label={`Remover ${file.name}`}
      onClick={() => {
        reportValidation("");
        settings.onValueChange(settings.value.filter((_file, fileIndex) => fileIndex !== index));
      }}
    >
      <X aria-hidden="true" />
    </Button>
  );
}
function FilePreview({ file }: { file: File }): ReactElement {
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <span className="file-upload__preview">
      {preview ? <img src={preview} alt="" /> : <FileFallback file={file} />}
    </span>
  );
}
function FileFallback({ file }: { file: File }): ReactElement {
  if (file.type.startsWith("image/")) return <ImageIcon aria-hidden="true" />;
  return <FileText aria-hidden="true" />;
}
