"use client";
import { useEffect, useState, type ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button, ToastAlert } from "@lazuli/ui";
import styles from "./mobile-upload.module.css";
export function MobileUploadLink({ url }: { url?: string | undefined }): ReactElement {
  const [originReady, setOriginReady] = useState(false);
  const [mobileOrigin, setMobileOrigin] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/mobile-upload-origin")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { origin: string | null };
        if (active) setMobileOrigin(data.origin);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setOriginReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const destination =
    originReady && url ? (mobileOrigin ? url.replace(location.origin, mobileOrigin) : url) : null;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className={styles.stack}>
      <div className={styles.qr} aria-busy={!destination}>
        {destination ? (
          <QRCodeSVG
            value={destination}
            size={192}
            marginSize={4}
            title="Enviar documentos pelo celular"
          />
        ) : (
          <p role="status" className={styles.qrPending}>
            Preparando QR code…
          </p>
        )}
      </div>
      <div className={`${styles.actions} ${styles.qrActions}`}>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label={copied ? "Link copiado" : "Copiar link"}
          title={copied ? "Link copiado" : "Copiar link"}
          disabled={!destination}
          onClick={() => {
            if (!destination) return;
            void navigator.clipboard
              .writeText(destination)
              .then(() => setCopied(true))
              .catch(() => setError("Não foi possível copiar. Use Abrir link."));
          }}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
        <Button
          size="icon-sm"
          variant="secondary"
          disabled={!destination}
          nativeButton={false}
          render={<a href={destination ?? undefined} target="_blank" rel="noreferrer" />}
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
