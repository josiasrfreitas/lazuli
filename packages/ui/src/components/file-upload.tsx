"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Camera, Check, FileText, ImageIcon, Paperclip, UploadCloud, X } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";

export type FileUploadProps = {
  value: File[];
  onValueChange: (files: File[]) => void;
  accept?: string;
  acceptLabel?: string;
  maxSize: number;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  /** Upload progress must come from the transport; omit for an indeterminate transfer. */
  progress?: number;
  status?: "idle" | "uploading" | "success";
  statusLabel?: string;
  error?: string;
  onValidationError?: (message: string) => void;
  camera?: boolean;
  className?: string;
  /** An inline picker for files attached to an existing form row. */
  compact?: boolean;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1024 * 1024 ? "KB" : "MB";
  const size = bytes / (unit === "KB" ? 1024 : 1024 * 1024);
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(size)} ${unit}`;
}

function acceptsFile(file: File, accept?: string): boolean {
  if (!accept) return true;
  return accept.split(",").some((entry) => {
    const type = entry.trim().toLowerCase();
    if (type.startsWith(".")) return file.name.toLowerCase().endsWith(type);
    if (type.endsWith("/*")) return file.type.startsWith(type.slice(0, -1));
    return file.type === type;
  });
}

/** File selection only. Uploads and their persistence remain the caller's responsibility. */
export function FileUpload({
  value,
  onValueChange,
  accept,
  acceptLabel = "Arquivos",
  maxSize,
  multiple = false,
  maxFiles = 20,
  disabled = false,
  progress,
  status = "idle",
  statusLabel,
  error,
  onValidationError,
  camera = false,
  className,
  compact = false,
}: FileUploadProps) {
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const cameraPicker = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState("");
  const locked = disabled || status !== "idle";
  const message = validationError || error;
  const percent = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));
  const label = statusLabel ?? (status === "success" ? "Arquivo anexado" : "Enviando arquivo…");

  function reportValidation(message: string) {
    setValidationError(message);
    onValidationError?.(message);
  }

  function selectFiles(incoming: File[]) {
    if (locked || incoming.length === 0) return;
    reportValidation("");
    if (!multiple && incoming.length > 1) {
      reportValidation("Escolha um arquivo por vez.");
      return;
    }
    for (const file of incoming) {
      if (!file.size) {
        reportValidation(`“${file.name}” está vazio. Escolha outro arquivo.`);
        return;
      }
      if (!acceptsFile(file, accept)) {
        reportValidation(`“${file.name}” não está em um formato aceito. Use ${acceptLabel}.`);
        return;
      }
      if (file.size > maxSize) {
        reportValidation(
          `“${file.name}” ultrapassa ${formatFileSize(maxSize)}. Escolha um arquivo menor.`,
        );
        return;
      }
    }
    const next = multiple
      ? [...value, ...incoming].filter(
          (file, index, all) =>
            all.findIndex(
              (other) =>
                other.name === file.name &&
                other.size === file.size &&
                other.lastModified === file.lastModified,
            ) === index,
        )
      : incoming;
    if (next.length > maxFiles) {
      reportValidation(`Selecione até ${maxFiles} arquivos por envio.`);
      return;
    }
    onValueChange(next);
  }

  function dragEnter(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    if (!locked) setDragging(true);
  }

  return (
    <div
      className={cn("file-upload", className)}
      data-state={message ? "error" : status}
      data-dragging={dragging || undefined}
      data-disabled={disabled || undefined}
      data-compact={compact || undefined}
      onDragEnter={dragEnter}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = locked ? "none" : "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        selectFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={picker}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={locked}
        tabIndex={-1}
        aria-hidden="true"
        className="file-upload__input"
        onChange={(event) => {
          selectFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      {camera && (
        <input
          ref={cameraPicker}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          disabled={locked}
          tabIndex={-1}
          aria-hidden="true"
          className="file-upload__input"
          onChange={(event) => {
            selectFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      )}
      {status === "idle" && (
        <div
          className="file-upload__dropzone"
          data-compact={compact || value.length > 0 || undefined}
        >
          <UploadCloud aria-hidden="true" className="file-upload__symbol" />
          <div className="file-upload__instructions">
            <p className="file-upload__title">
              {dragging
                ? "Solte o arquivo aqui"
                : value.length
                  ? "Confira a seleção"
                  : "Escolha o arquivo para anexar"}
            </p>
            <p className="file-upload__drag-hint">
              {value.length
                ? multiple
                  ? "Você pode adicionar mais arquivos."
                  : "Confira o arquivo antes de enviar."
                : "Arraste o arquivo ou escolha no seu dispositivo."}
            </p>
            <p className="file-upload__touch-hint">
              {value.length
                ? "Confira a seleção antes de enviar."
                : "Escolha um arquivo ou uma foto no seu dispositivo."}
            </p>
          </div>
          <div className="file-upload__pickers">
            <Button
              variant="secondary"
              size={compact ? "sm" : "compact-responsive"}
              disabled={locked}
              aria-describedby={`${id}-help${message ? ` ${id}-error` : ""}`}
              aria-invalid={Boolean(message)}
              data-file-upload-picker
              onClick={() => picker.current?.click()}
            >
              <Paperclip aria-hidden="true" />
              {value.length
                ? multiple
                  ? "Adicionar arquivos"
                  : "Trocar arquivo"
                : multiple
                  ? "Escolher arquivos"
                  : "Escolher arquivo"}
            </Button>
            {camera && (
              <Button
                variant="ghost"
                size={compact ? "sm" : "compact-responsive"}
                className="file-upload__camera"
                disabled={locked}
                onClick={() => cameraPicker.current?.click()}
              >
                <Camera aria-hidden="true" />
                Usar câmera
              </Button>
            )}
          </div>
          <p id={`${id}-help`} className="file-upload__hint">
            {acceptLabel} · até {formatFileSize(maxSize)}
            {multiple ? " por arquivo" : ""}
          </p>
        </div>
      )}
      {value.length > 0 && (
        <ul className="file-upload__files" aria-label="Arquivos selecionados">
          {value.map((file, index) => (
            <li
              className="file-upload__file"
              key={`${file.name}-${file.size}-${file.lastModified}`}
            >
              <FilePreview file={file} />
              <div className="file-upload__file-details">
                <p className="file-upload__file-name">{file.name}</p>
                <p className="file-upload__hint">
                  {formatFileSize(file.size)}
                  {status === "idle" && " · Pronto para enviar"}
                </p>
              </div>
              {status === "success" ? (
                <Check aria-hidden="true" className="file-upload__check" />
              ) : status === "idle" ? (
                <Button
                  variant="ghost"
                  size="icon-compact-responsive"
                  disabled={disabled}
                  aria-label={`Remover ${file.name}`}
                  onClick={() => {
                    reportValidation("");
                    onValueChange(value.filter((_, fileIndex) => fileIndex !== index));
                  }}
                >
                  <X aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {status !== "idle" && (
        <div className="file-upload__transfer">
          <div className="file-upload__transfer-label" role="status" aria-live="polite">
            <span>{label}</span>
            {status === "uploading" && percent !== undefined && <span>{Math.round(percent)}%</span>}
          </div>
          {status === "uploading" &&
            (percent === undefined ? (
              <div
                className="file-upload__activity"
                role="progressbar"
                aria-label="Enviando arquivo"
              >
                <span />
              </div>
            ) : (
              <progress
                className="file-upload__progress"
                max={100}
                value={percent}
                aria-label="Progresso do envio"
              />
            ))}
        </div>
      )}
      {message && (
        <p id={`${id}-error`} role="alert" className="file-upload__error">
          {message}
        </p>
      )}
    </div>
  );
}

function FilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <span className="file-upload__preview">
      {preview ? (
        <img src={preview} alt="" />
      ) : file.type.startsWith("image/") ? (
        <ImageIcon aria-hidden="true" />
      ) : (
        <FileText aria-hidden="true" />
      )}
    </span>
  );
}
