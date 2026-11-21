"use client";
import { useState, type ReactNode, type ReactElement } from "react";
import { ArrowLeft, Paperclip, Plus, QrCode, X } from "lucide-react";
import { Button } from "./button";
import { FileUpload } from "./file-upload";
import { Input } from "./input";
type AttachmentPanelProps = {
  title?: string;
  children: ReactNode;
  onBack?: (() => void) | undefined;
  onMobile?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  busy?: boolean;
  className?: string | undefined;
  id?: string;
  open?: boolean;
  variant?: "sidebar" | "card";
};
export function AttachmentPanel({
  title = "Anexos",
  children,
  onBack,
  onMobile,
  onClose,
  busy = false,
  className = "",
  id,
  open,
  variant = "sidebar",
}: AttachmentPanelProps): ReactElement {
  return (
    <aside
      id={id}
      className={`attachment-panel ${variant === "sidebar" ? "dark" : ""} ${className}`}
      data-variant={variant}
      aria-label={title}
      data-open={open}
      inert={open === false}
    >
      <header className="attachment-panel__header">
        <div className="attachment-panel__heading">
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Voltar aos anexos"
              disabled={busy}
              onClick={onBack}
            >
              <ArrowLeft />
            </Button>
          )}
          <h2>{title}</h2>
        </div>
        <div className="attachment-panel__actions">
          {onMobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Enviar pelo celular"
              disabled={busy}
              onClick={onMobile}
            >
              <QrCode />
            </Button>
          )}
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar anexos"
              disabled={busy}
              onClick={onClose}
            >
              <X />
            </Button>
          )}
        </div>
      </header>
      {children}
    </aside>
  );
}
export function AttachmentRow({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}): ReactElement {
  return (
    <li className="attachment-panel__row">
      <div className="attachment-panel__copy">
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
      </div>
      <div className="attachment-panel__actions">{children}</div>
    </li>
  );
}
export function AttachmentAdd({
  onAdd,
  disabled = false,
}: {
  onAdd: (value: { title: string; subtitle: string }) => void;
  disabled?: boolean;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const add = (): void => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), subtitle: subtitle.trim() });
    setTitle("");
    setSubtitle("");
    setEditing(false);
  };
  return editing ? (
    <div className="attachment-panel__add">
      <Input
        autoFocus
        aria-label="Título do anexo"
        placeholder="Título do anexo"
        maxLength={100}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
      />
      <Input
        aria-label="Subtítulo do anexo"
        placeholder="Orientação ou descrição (opcional)"
        maxLength={240}
        value={subtitle}
        onChange={(event) => setSubtitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
      />
      <div className="attachment-panel__actions">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Adicionar anexo"
          disabled={disabled || !title.trim()}
          onClick={add}
        >
          <Plus />
        </Button>
      </div>
    </div>
  ) : (
    <Button
      type="button"
      className="w-full"
      variant="secondary"
      disabled={disabled}
      onClick={() => setEditing(true)}
    >
      <Plus />
      Adicionar anexo
    </Button>
  );
}

export function AttachmentUploadRow({
  title,
  subtitle,
  onFile,
  children,
  disabled = false,
  accept,
  acceptLabel,
  maxSize,
  maxSizeByType,
  sizeLabel,
  uploaded = false,
}: {
  title: string;
  subtitle?: string | undefined;
  onFile: (file: File) => void;
  children?: ReactNode;
  disabled?: boolean;
  accept: string;
  acceptLabel: string;
  maxSize: number;
  maxSizeByType?: Record<string, number> | undefined;
  sizeLabel?: string | undefined;
  uploaded?: boolean;
}): ReactElement {
  return (
    <li className="attachment-panel__upload">
      <FileUpload
        compact
        value={[]}
        onValueChange={(files) => {
          if (files[0]) onFile(files[0]);
        }}
        accept={accept}
        acceptLabel={acceptLabel}
        maxSize={maxSize}
        maxSizeByType={maxSizeByType}
        sizeLabel={sizeLabel}
        disabled={disabled}
        renderTrigger={({ open, disabled: locked }) => (
          <div className="attachment-panel__row">
            <div className="attachment-panel__copy">
              <strong>{title}</strong>
              {subtitle && <small>{subtitle}</small>}
              <small className="attachment-panel__drop-hint">Arraste um arquivo aqui</small>
            </div>
            <div className="attachment-panel__actions">
              <Button type="button" variant="secondary" size="sm" disabled={locked} onClick={open}>
                <Paperclip />
                {uploaded ? "Trocar" : "Enviar"}
              </Button>
              {children}
            </div>
          </div>
        )}
      />
    </li>
  );
}
