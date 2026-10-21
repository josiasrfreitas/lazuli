import { useId, useRef, useState, type DragEvent, type RefObject } from "react";
import { incomingFileSelection } from "./file-upload-selection";
import {
  fileUploadSettings,
  type FileUploadProps,
  type FileUploadSettings,
} from "./file-upload.types";
const COMPLETE = 100;
export type FileUploadState = {
  settings: FileUploadSettings;
  id: string;
  picker: RefObject<HTMLInputElement | null>;
  cameraPicker: RefObject<HTMLInputElement | null>;
  locked: boolean;
  message: string | undefined;
  percent: number | undefined;
  label: string;
  reportValidation: (message: string) => void;
  selectFiles: (files: File[]) => void;
};
export function useFileUpload(props: FileUploadProps): FileUploadState {
  const settings = fileUploadSettings(props);
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const cameraPicker = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState("");
  const locked = settings.disabled || settings.status !== "idle";
  const reportValidation = (message: string): void => {
    setValidationError(message);
    settings.onValidationError?.(message);
  };
  const selectFiles = (incoming: File[]): void => {
    if (locked || incoming.length === 0) return;
    reportValidation("");
    const selection = incomingFileSelection(settings, incoming);
    if (selection.error !== null) {
      reportValidation(selection.error);
      return;
    }
    settings.onValueChange(selection.files);
  };
  return {
    settings,
    id,
    picker,
    cameraPicker,
    locked,
    message: validationError || settings.error,
    percent:
      settings.progress === undefined
        ? undefined
        : Math.max(0, Math.min(COMPLETE, settings.progress)),
    label:
      settings.statusLabel ??
      (settings.status === "success" ? "Arquivo anexado" : "Enviando arquivo…"),
    reportValidation,
    selectFiles,
  };
}
export function useFileDrop(state: FileUploadState): {
  dragging: boolean;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
} {
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    onDragEnter(event) {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      depth.current += 1;
      if (!state.locked) setDragging(true);
    },
    onDragOver(event) {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = state.locked ? "none" : "copy";
    },
    onDragLeave(event) {
      event.preventDefault();
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop(event) {
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      state.selectFiles([...event.dataTransfer.files]);
    },
  };
}
