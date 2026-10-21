export type FileUploadProps = {
  value: File[];
  onValueChange: (files: File[]) => void;
  accept?: string;
  acceptLabel?: string;
  maxSize: number;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  /** Measured transport progress; omit for an indeterminate transfer. */
  progress?: number;
  status?: "idle" | "uploading" | "success";
  statusLabel?: string;
  error?: string;
  onValidationError?: (message: string) => void;
  camera?: boolean;
  className?: string;
  compact?: boolean;
};
export type FileUploadSettings = FileUploadProps & {
  multiple: boolean;
  maxFiles: number;
  disabled: boolean;
  status: "idle" | "uploading" | "success";
  acceptLabel: string;
  camera: boolean;
  compact: boolean;
};
const DEFAULT_MAX_FILES = 20;
export function fileUploadSettings({
  multiple = false,
  maxFiles = DEFAULT_MAX_FILES,
  disabled = false,
  status = "idle",
  acceptLabel = "Arquivos",
  camera = false,
  compact = false,
  ...props
}: FileUploadProps): FileUploadSettings {
  return { ...props, multiple, maxFiles, disabled, status, acceptLabel, camera, compact };
}
