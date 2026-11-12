"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Button, Field, FieldError, FileUpload, Input, Label, ToastAlert } from "@lazuli/ui";
export type MobileFileInput = { kind: string; label: string; subtitle?: string; file: File };
export type UploadCategory = {
  id: string;
  label: string;
  subtitle?: string;
  photo?: boolean;
  customLabel?: boolean;
};
export function MobileFileEditor({
  category,
  onSend,
  onBack,
  onBusyChange,
  compact = false,
}: {
  category: UploadCategory;
  compact?: boolean;
  onSend: (input: MobileFileInput) => Promise<void>;
  onBack: () => void;
  onBusyChange?: (busy: boolean) => void;
}): ReactElement {
  const [label, setLabel] = useState(category.customLabel ? "" : category.label);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [invalidFile, setInvalidFile] = useState("");
  const [labelError, setLabelError] = useState("");
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
  }, []);
  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || invalidFile) return;
    if (!label.trim()) {
      setLabelError("Dê um nome ao documento.");
      first.current?.focus();
      return;
    }
    const file = files[0];
    if (!file) {
      setError("Selecione um arquivo ou tire uma foto.");
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await onSend({
        kind: category.id,
        label: label.trim(),
        ...(category.subtitle ? { subtitle: category.subtitle } : {}),
        file,
      });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Não foi possível enviar. Tente novamente.",
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className={compact ? "grid gap-3" : "grid gap-4"}
    >
      <Field>
        <Label htmlFor="upload-label">
          {category.photo ? "Descrição da foto" : "Nome do documento"}
        </Label>
        <Input
          ref={first}
          id="upload-label"
          name="label"
          autoComplete="off"
          placeholder={category.photo ? "Foto do professor" : "Ex.: Diploma de licenciatura"}
          size="sm"
          maxLength={100}
          value={label}
          invalid={Boolean(labelError)}
          disabled={busy}
          onChange={(event) => {
            setLabel(event.target.value);
            setLabelError("");
          }}
        />
        {labelError && <FieldError match>{labelError}</FieldError>}
      </Field>
      <FileUpload
        compact={!compact}
        camera
        value={files}
        onValueChange={(value) => {
          setFiles(value);
          setError("");
          setInvalidFile("");
        }}
        onValidationError={setInvalidFile}
        accept={category.photo ? "image/jpeg,image/png" : "application/pdf,image/jpeg,image/png"}
        acceptLabel={category.photo ? "JPG ou PNG" : "PDF, JPG ou PNG"}
        maxSize={5 * 1024 * 1024}
        status={busy ? "uploading" : "idle"}
        disabled={busy}
      />
      {error && <ToastAlert variant="destructive">{error}</ToastAlert>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onBack}>
          {compact ? "Cancelar" : "Voltar"}
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Enviando…" : "Enviar arquivo"}
        </Button>
      </div>
    </form>
  );
}
