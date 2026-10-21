import type { ReactElement } from "react";
import type { FileUploadState } from "./file-upload-state";
const COMPLETE = 100;
export function FileUploadTransfer({ state }: { state: FileUploadState }): ReactElement {
  const { settings, label, percent } = state;
  return (
    <div className="file-upload__transfer">
      <div className="file-upload__transfer-label" role="status" aria-live="polite">
        <span>{label}</span>
        {settings.status === "uploading" && percent !== undefined && (
          <span>{Math.round(percent)}%</span>
        )}
      </div>
      {settings.status === "uploading" &&
        (percent === undefined ? (
          <div className="file-upload__activity" role="progressbar" aria-label="Enviando arquivo">
            <span />
          </div>
        ) : (
          <progress
            className="file-upload__progress"
            max={COMPLETE}
            value={percent}
            aria-label="Progresso do envio"
          />
        ))}
    </div>
  );
}
