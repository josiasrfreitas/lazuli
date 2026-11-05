import { useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, QrCode } from "lucide-react";
import {
  ToastAlert,
  Button,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@lazuli/ui";
import type { EnrollmentDocuments } from "./use-enrollment-documents";
import { DocumentReviewNotice } from "./review-notice";
import styles from "./documents.module.css";

const QR_CELL_DELAY_MS = 20;
const QR_COVER_DURATION_MS = 350;

export function DocumentQrButton({
  documents,
  disabled = false,
}: {
  documents: EnrollmentDocuments;
  disabled?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  function prepare(): void {
    setOpen(true);
    void documents.ensureSession().catch(() => {
      /* Dialog owns retry. */
    });
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onClick={prepare}
        aria-label="Gerar QR code para enviar documentos pelo celular"
        title="Enviar documentos pelo celular"
      >
        <QrCode aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <QrDialogContent documents={documents} onRetry={prepare} />
        </DialogPortal>
      </Dialog>
    </>
  );
}
function QrDialogContent({
  documents,
  onRetry,
}: {
  documents: EnrollmentDocuments;
  onRetry: () => void;
}): ReactElement {
  return (
    <DialogContent className="gap-4">
      <DialogHeader>
        <DialogTitle>Enviar pelo celular</DialogTitle>
        <DialogDescription>
          Escaneie este QR code para enviar os documentos. Mantenha o cadastro aberto no computador.
        </DialogDescription>
      </DialogHeader>
      <QrDialogState documents={documents} onRetry={onRetry} />
      <DocumentReviewNotice />
    </DialogContent>
  );
}
function QrDialogState({
  documents,
  onRetry,
}: {
  documents: EnrollmentDocuments;
  onRetry: () => void;
}): ReactElement {
  if (documents.session) return <SessionLink token={documents.session.token} />;
  if (!documents.create.isError) return <p role="status">Preparando QR code…</p>;
  return (
    <ToastAlert variant="destructive">
      Não foi possível gerar o QR code.
      <Button type="button" variant="ghost" onClick={onRetry}>
        Tentar novamente
      </Button>
    </ToastAlert>
  );
}
export function SessionLink({ token }: { token: string }): ReactElement {
  const qrHost = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => animateQr(qrHost.current), [token]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const url = `${location.origin}/documentos#${token}`;
  return (
    <div className={styles.stack}>
      <div className={styles.qr} ref={qrHost}>
        <QRCodeSVG value={url} size={192} marginSize={4} title="Enviar documentos pelo celular" />
      </div>
      <div className={`${styles.actions} ${styles.qrActions}`}>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label={copied ? "Link copiado" : "Copiar link"}
          title={copied ? "Link copiado" : "Copiar link"}
          onClick={() => {
            void navigator.clipboard
              .writeText(url)
              .then(() => setCopied(true))
              .catch(() => setError("Não foi possível copiar. Use Abrir link."));
          }}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
        <Button
          size="icon-sm"
          variant="secondary"
          nativeButton={false}
          render={<a href={url} target="_blank" rel="noreferrer" />}
          aria-label="Abrir link"
          title="Abrir link"
        >
          <ExternalLink aria-hidden="true" />
        </Button>
      </div>
      {error && <ToastAlert variant="warning">{error}</ToastAlert>}
    </div>
  );
}

// A temporary white cover reveals cells without changing the encoded QR paths.
function animateQr(host: HTMLDivElement | null): (() => void) | undefined {
  const svg = host?.querySelector("svg");
  if (!svg || globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const size = svg.viewBox.baseVal.width;
  if (!Number.isInteger(size) || size <= 0) return;
  const namespace = "http://www.w3.org/2000/svg";
  const cover = document.createElementNS(namespace, "g");
  cover.setAttribute("aria-hidden", "true");
  cover.setAttribute("fill", "white");
  cover.setAttribute("shape-rendering", "crispEdges");
  const groups = Array.from({ length: 16 }, () => "");
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const group = Math.floor(Math.random() * groups.length);
      groups[group] += `M${column} ${row}h1v1h-1z`;
    }
  }
  const animations = groups.map((path, index) => {
    const cells = document.createElementNS(namespace, "path");
    cells.setAttribute("d", path);
    cover.append(cells);
    return cells.animate([{ opacity: 1 }, { opacity: 0 }], {
      delay: index * QR_CELL_DELAY_MS,
      duration: 40,
      fill: "forwards",
      easing: "steps(1, end)",
    });
  });
  svg.append(cover);
  const timer = globalThis.setTimeout(() => cover.remove(), QR_COVER_DURATION_MS);
  return () => {
    globalThis.clearTimeout(timer);
    for (const animation of animations) animation.cancel();
    cover.remove();
  };
}
