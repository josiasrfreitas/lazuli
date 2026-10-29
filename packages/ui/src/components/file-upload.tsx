"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEventHandler,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { Camera, Check, FileText, ImageIcon, Paperclip, UploadCloud, X } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";

const KIBIBYTE = 1024;
const MEBIBYTE = KIBIBYTE * KIBIBYTE;
const DEFAULT_MAX_FILES = 20;
const FULL_PERCENT = 100;

export type FileUploadProps = {
  value: File[];
  onValueChange: (files: File[]) => void;
  accept?: string | undefined;
  acceptLabel?: string | undefined;
  maxSize: number;
  /** Optional stricter limits for specific MIME types. */
  maxSizeByType?: Readonly<Record<string, number>> | undefined;
  /** Human-readable limits when accepted formats have different size limits. */
  sizeLabel?: string | undefined;
  multiple?: boolean | undefined;
  maxFiles?: number | undefined;
  disabled?: boolean | undefined;
  /** Upload progress must come from the transport; omit for an indeterminate transfer. */
  progress?: number | undefined;
  status?: ("idle" | "uploading" | "success") | undefined;
  statusLabel?: string | undefined;
  error?: string | undefined;
  onValidationError?: ((message: string) => void) | undefined;
  camera?: boolean | undefined;
  className?: string | undefined;
  /** An inline picker for files attached to an existing form row. */
  compact?: boolean | undefined;
  /** Places the selected file beside the picker when space permits. */
  layout?: "stacked" | "inline" | undefined;
  /** Reuse selection/validation with a contextual picker such as a profile avatar. */
  renderTrigger?: ((picker: { open: () => void; disabled: boolean }) => ReactNode) | undefined;
};

export function formatFileSize(bytes: number): string {
  if (bytes < KIBIBYTE) return `${bytes} B`;
  const unit = bytes < MEBIBYTE ? "KB" : "MB";
  const size = bytes / (unit === "KB" ? KIBIBYTE : MEBIBYTE);
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

type UploadOptions = FileUploadProps & {
  acceptLabel: string;
  multiple: boolean;
  maxFiles: number;
  disabled: boolean;
  status: NonNullable<FileUploadProps["status"]>;
  camera: boolean;
  compact: boolean;
};
type FileSelection = {
  validationError: string;
  reportValidation: (message: string) => void;
  selectFiles: (incoming: File[]) => void;
};
type FileDrop = {
  dragging: boolean;
  onDragEnter: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
};
type UploadView = UploadOptions &
  FileSelection &
  FileDrop & {
    id: string;
    picker: RefObject<HTMLInputElement | null>;
    cameraPicker: RefObject<HTMLInputElement | null>;
    locked: boolean;
    message: string | undefined;
    percent: number | undefined;
    label: string;
  };
type UploadViewProps = { view: UploadView };
function uploadOptions(props: FileUploadProps): UploadOptions {
  const {
    acceptLabel = "Arquivos",
    multiple = false,
    maxFiles = DEFAULT_MAX_FILES,
    disabled = false,
    status = "idle",
    camera = false,
    compact = false,
  } = props;
  return { ...props, acceptLabel, multiple, maxFiles, disabled, status, camera, compact };
}
/** File selection only. Uploads and their persistence remain the caller's responsibility. */
export function FileUpload(props: FileUploadProps): ReactElement {
  const options = uploadOptions(props);
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const cameraPicker = useRef<HTMLInputElement>(null);
  const selection = useFileSelection(options);
  const locked = options.disabled || options.status !== "idle";
  const drop = useFileDrop({ locked, selectFiles: selection.selectFiles });
  const { progress, status, statusLabel, error } = options;
  const message = selection.validationError || error;
  const percent =
    progress === undefined ? undefined : Math.max(0, Math.min(FULL_PERCENT, progress));
  const label = statusLabel ?? (status === "success" ? "Arquivo anexado" : "Enviando arquivo…");
  const view = {
    ...options,
    ...selection,
    ...drop,
    id,
    picker,
    cameraPicker,
    locked,
    message,
    percent,
    label,
  };
  return <UploadSurface view={view} />;
}
function useFileSelection(options: UploadOptions): FileSelection {
  const { value, onValueChange, multiple, maxFiles, disabled, status, onValidationError } = options;
  const locked = disabled || status !== "idle";
  const [validationError, setValidationError] = useState("");
  function reportValidation(message: string): void {
    setValidationError(message);
    onValidationError?.(message);
  }
  function selectFiles(incoming: File[]): void {
    if (locked || incoming.length === 0) return;
    reportValidation("");
    const error = incomingError(incoming, options);
    if (error) {
      reportValidation(error);
      return;
    }
    const next = multiple ? uniqueFiles([...value, ...incoming]) : incoming;
    if (next.length > maxFiles) {
      reportValidation(`Selecione até ${maxFiles} arquivos por envio.`);
      return;
    }
    onValueChange(next);
  }
  return { validationError, reportValidation, selectFiles };
}
function incomingError(incoming: File[], options: UploadOptions): string | null {
  if (!options.multiple && incoming.length > 1) return "Escolha um arquivo por vez.";
  for (const file of incoming) {
    const error = fileError(file, options);
    if (error) return error;
  }
  return null;
}
function fileError(file: File, options: UploadOptions): string | null {
  if (file.size === 0) return `“${file.name}” está vazio. Escolha outro arquivo.`;
  if (!acceptsFile(file, options.accept))
    return `“${file.name}” não está em um formato aceito. Use ${options.acceptLabel}.`;
  const maxSize = Math.min(options.maxSize, options.maxSizeByType?.[file.type] ?? options.maxSize);
  if (file.size > maxSize)
    return `“${file.name}” ultrapassa ${formatFileSize(maxSize)}. Escolha um arquivo menor.`;
  return null;
}
function uniqueFiles(files: File[]): File[] {
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
function useFileDrop({
  locked,
  selectFiles,
}: {
  locked: boolean;
  selectFiles: (files: File[]) => void;
}): FileDrop {
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    onDragEnter: (event) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      dragDepth.current += 1;
      if (!locked) setDragging(true);
    },
    onDragOver: (event) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = locked ? "none" : "copy";
    },
    onDragLeave: (event) => {
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      selectFiles([...event.dataTransfer.files]);
    },
  };
}

function UploadSurface({ view }: UploadViewProps): ReactElement {
  const { className, message, status, dragging, disabled, compact, id, value } = view;
  return (
    <div
      className={cn("file-upload", className)}
      data-state={message ? "error" : status}
      data-dragging={dragging || undefined}
      data-disabled={disabled || undefined}
      data-compact={compact || undefined}
      data-layout={view.layout ?? "stacked"}
      onDragEnter={view.onDragEnter}
      onDragOver={view.onDragOver}
      onDragLeave={view.onDragLeave}
      onDrop={view.onDrop}
    >
      <UploadInputs view={view} />
      {status === "idle" &&
        (view.renderTrigger ? (
          view.renderTrigger({ open: () => view.picker.current?.click(), disabled: view.locked })
        ) : (
          <UploadDropzone view={view} />
        ))}
      {value.length > 0 && <UploadFiles view={view} />}
      {status !== "idle" && <UploadTransfer view={view} />}
      {message && (
        <p id={`${id}-error`} role="alert" className="file-upload__error">
          {message}
        </p>
      )}
    </div>
  );
}

function UploadInputs({ view }: UploadViewProps): ReactElement {
  const { picker, cameraPicker, accept, multiple, locked, selectFiles, camera } = view;
  return (
    <>
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
          selectFiles([...(event.target.files ?? [])]);
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
            selectFiles([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      )}
    </>
  );
}

function UploadDropzone({ view }: UploadViewProps): ReactElement {
  const { compact, value, acceptLabel, maxSize, multiple, id } = view;
  return (
    <div className="file-upload__dropzone" data-compact={compact || value.length > 0 || undefined}>
      <UploadCloud aria-hidden="true" className="file-upload__symbol" />
      <UploadInstructions view={view} />
      <UploadPickers view={view} />
      <p id={`${id}-help`} className="file-upload__hint">
        {acceptLabel} · {view.sizeLabel ?? `até ${formatFileSize(maxSize)}`}
        {multiple ? " por arquivo" : ""}
      </p>
    </div>
  );
}

function UploadInstructions({ view }: UploadViewProps): ReactElement {
  const { dragging, value, multiple } = view;
  return (
    <div className="file-upload__instructions">
      <p className="file-upload__title">{uploadTitle(dragging, value.length > 0)}</p>
      <p className="file-upload__drag-hint">{dragHint(value.length > 0, multiple)}</p>
      <p className="file-upload__touch-hint">
        {value.length > 0
          ? "Confira a seleção antes de enviar."
          : "Escolha um arquivo ou uma foto no seu dispositivo."}
      </p>
    </div>
  );
}

function UploadPickers({ view }: UploadViewProps): ReactElement {
  const { compact, locked, id, message, picker, value, multiple, camera, cameraPicker } = view;
  return (
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
        {filePickerLabel(value.length > 0, multiple)}
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
  );
}

function UploadTransfer({ view }: UploadViewProps): ReactElement {
  const { label, status, percent } = view;
  return (
    <div className="file-upload__transfer">
      <div className="file-upload__transfer-label" role="status" aria-live="polite">
        <span>{label}</span>
        {status === "uploading" && percent !== undefined && <span>{Math.round(percent)}%</span>}
      </div>
      {status === "uploading" &&
        (percent === undefined ? (
          <div className="file-upload__activity" role="progressbar" aria-label="Enviando arquivo">
            <span />
          </div>
        ) : (
          <progress
            className="file-upload__progress"
            max={FULL_PERCENT}
            value={percent}
            aria-label="Progresso do envio"
          />
        ))}
    </div>
  );
}

function UploadFiles({ view }: UploadViewProps): ReactElement {
  return (
    <ul className="file-upload__files" aria-label="Arquivos selecionados">
      {view.value.map((file, index) => (
        <UploadFile
          key={`${file.name}-${file.size}-${file.lastModified}`}
          view={view}
          file={file}
          index={index}
        />
      ))}
    </ul>
  );
}
type FileRowProps = UploadViewProps & { file: File; index: number };
function UploadFile({ view, file, index }: FileRowProps): ReactElement {
  const { status } = view;
  return (
    <li className="file-upload__file" key={`${file.name}-${file.size}-${file.lastModified}`}>
      <FilePreview file={file} />
      <div className="file-upload__file-details">
        <p className="file-upload__file-name">{file.name}</p>
        <p className="file-upload__hint">
          {formatFileSize(file.size)}
          {status === "idle" && " · Pronto para enviar"}
        </p>
      </div>
      {<UploadFileAction view={view} file={file} index={index} />}
    </li>
  );
}
function UploadFileAction({ view, file, index }: FileRowProps): ReactElement | null {
  const { status, disabled, reportValidation, onValueChange, value } = view;
  if (status === "success") return <Check aria-hidden="true" className="file-upload__check" />;
  if (status !== "idle") return null;
  return (
    <Button
      variant="ghost"
      size="icon-compact-responsive"
      disabled={disabled}
      aria-label={`Remover ${file.name}`}
      onClick={() => {
        reportValidation("");
        onValueChange(value.filter((_unused, fileIndex) => fileIndex !== index));
      }}
    >
      <X aria-hidden="true" />
    </Button>
  );
}
function uploadTitle(dragging: boolean, hasFiles: boolean): string {
  if (dragging) return "Solte o arquivo aqui";
  return hasFiles ? "Confira a seleção" : "Escolha o arquivo para anexar";
}
function dragHint(hasFiles: boolean, multiple: boolean): string {
  if (!hasFiles) return "Arraste o arquivo ou escolha no seu dispositivo.";
  return multiple ? "Você pode adicionar mais arquivos." : "Confira o arquivo antes de enviar.";
}
function filePickerLabel(hasFiles: boolean, multiple: boolean): string {
  if (hasFiles) return multiple ? "Adicionar arquivos" : "Trocar arquivo";
  return multiple ? "Escolher arquivos" : "Escolher arquivo";
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
      {preview ? (
        <img src={preview} alt="" />
      ) : (
        <FilePreviewIcon image={file.type.startsWith("image/")} />
      )}
    </span>
  );
}
function FilePreviewIcon({ image }: { image: boolean }): ReactElement {
  return image ? <ImageIcon aria-hidden="true" /> : <FileText aria-hidden="true" />;
}
