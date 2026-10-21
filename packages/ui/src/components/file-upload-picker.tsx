import type { ReactElement } from "react";
import { Camera, Paperclip, UploadCloud } from "lucide-react";
import { Button } from "./button";
import { formatFileSize } from "./file-upload-selection";
import type { FileUploadState } from "./file-upload-state";

export function FileUploadInputs({ state }: { state: FileUploadState }): ReactElement {
  const { picker, cameraPicker, settings, locked, selectFiles } = state;
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept={settings.accept}
        multiple={settings.multiple}
        disabled={locked}
        tabIndex={-1}
        aria-hidden="true"
        className="file-upload__input"
        onChange={(event) => {
          selectFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      {settings.camera && (
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
export function FileUploadDropzone({
  state,
  dragging,
}: {
  state: FileUploadState;
  dragging: boolean;
}): ReactElement {
  const { settings, id } = state;
  return (
    <div
      className="file-upload__dropzone"
      data-compact={settings.compact || settings.value.length > 0 || undefined}
    >
      <UploadCloud aria-hidden="true" className="file-upload__symbol" />
      <FileUploadInstructions state={state} dragging={dragging} />
      <FileUploadPickers state={state} />
      <p id={`${id}-help`} className="file-upload__hint">
        {settings.acceptLabel} · até {formatFileSize(settings.maxSize)}
        {settings.multiple ? " por arquivo" : ""}
      </p>
    </div>
  );
}
function FileUploadInstructions({
  state,
  dragging,
}: {
  state: FileUploadState;
  dragging: boolean;
}): ReactElement {
  const { value, multiple } = state.settings;
  const selected = value.length > 0;
  const title = uploadTitle(dragging, selected);
  const dragHint = dragHintText(selected, multiple);
  return (
    <div className="file-upload__instructions">
      <p className="file-upload__title">{title}</p>
      <p className="file-upload__drag-hint">{dragHint}</p>
      <p className="file-upload__touch-hint">
        {selected
          ? "Confira a seleção antes de enviar."
          : "Escolha um arquivo ou uma foto no seu dispositivo."}
      </p>
    </div>
  );
}
function FileUploadPickers({ state }: { state: FileUploadState }): ReactElement {
  const { settings, picker, cameraPicker, locked, id, message } = state;
  const title = pickerLabel(settings.value.length > 0, settings.multiple);
  return (
    <div className="file-upload__pickers">
      <Button
        variant="secondary"
        size={settings.compact ? "sm" : "compact-responsive"}
        disabled={locked}
        aria-describedby={`${id}-help${message ? ` ${id}-error` : ""}`}
        aria-invalid={Boolean(message)}
        data-file-upload-picker
        onClick={() => picker.current?.click()}
      >
        <Paperclip aria-hidden="true" />
        {title}
      </Button>
      {settings.camera && (
        <Button
          variant="ghost"
          size={settings.compact ? "sm" : "compact-responsive"}
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

function uploadTitle(dragging: boolean, selected: boolean): string {
  if (dragging) return "Solte o arquivo aqui";
  return selected ? "Confira a seleção" : "Escolha o arquivo para anexar";
}
function dragHintText(selected: boolean, multiple: boolean): string {
  if (!selected) return "Arraste o arquivo ou escolha no seu dispositivo.";
  return multiple ? "Você pode adicionar mais arquivos." : "Confira o arquivo antes de enviar.";
}
function pickerLabel(selected: boolean, multiple: boolean): string {
  if (selected) return multiple ? "Adicionar arquivos" : "Trocar arquivo";
  return multiple ? "Escolher arquivos" : "Escolher arquivo";
}
