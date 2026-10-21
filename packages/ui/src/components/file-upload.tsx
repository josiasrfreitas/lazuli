"use client";
import type { ReactElement } from "react";
import { cn } from "../lib/utils";
import { useFileDrop, useFileUpload } from "./file-upload-state";
import { FileUploadInputs, FileUploadDropzone } from "./file-upload-picker";
import { FileUploadFiles } from "./file-upload-files";
import { FileUploadTransfer } from "./file-upload-transfer";
import type { FileUploadProps } from "./file-upload.types";
export type { FileUploadProps } from "./file-upload.types";
export { formatFileSize } from "./file-upload-selection";

/** Selection only. Callers own authenticated transfer and durable persistence. */
export function FileUpload(props: FileUploadProps): ReactElement {
  const state = useFileUpload(props);
  const { dragging, ...dragEvents } = useFileDrop(state);
  const { settings, message, id } = state;
  return (
    <div
      className={cn("file-upload", settings.className)}
      data-state={message ? "error" : settings.status}
      data-dragging={dragging || undefined}
      data-disabled={settings.disabled || undefined}
      data-compact={settings.compact || undefined}
      {...dragEvents}
    >
      <FileUploadInputs state={state} />
      {settings.status === "idle" && <FileUploadDropzone state={state} dragging={dragging} />}
      {settings.value.length > 0 && <FileUploadFiles state={state} />}
      {settings.status !== "idle" && <FileUploadTransfer state={state} />}
      {message && (
        <p id={`${id}-error`} role="alert" className="file-upload__error">
          {message}
        </p>
      )}
    </div>
  );
}
