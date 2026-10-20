"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, Monitor, QrCode, RefreshCw } from "lucide-react";
import { Alert, Badge, Button, Input } from "@lazuli/ui";
import { QrWindowForm } from "./qr-fields";
import { attendanceTime } from "./location";
import type { AttendanceStatus } from "./staff-section";
import styles from "./teacher-page.module.css";

export type AttendanceShareAccess = {
  url: string;
  projectionUrl: string | null;
  expiresAt: Date;
};

export function AttendanceShareControls({
  status,
  access,
  previousLink = false,
  pending = false,
  generating = false,
  error,
  minutes,
  setMinutes,
  generate,
  close,
}: {
  status: Pick<AttendanceStatus, "format" | "restriction"> & { active: boolean };
  access: AttendanceShareAccess | null;
  previousLink?: boolean;
  pending?: boolean;
  generating?: boolean;
  error?: string | null;
  minutes: 10 | 20 | 30;
  setMinutes: (value: 10 | 20 | 30) => void;
  generate: () => void;
  close: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showQr, setShowQr] = useState(true);
  const url = access?.url;
  const projectionUrl = access?.projectionUrl;
  const active = status.active;
  useEffect(() => {
    setCopied(false);
    setCopyError(false);
    setShowQr(true);
  }, [url, access?.expiresAt]);
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <section className={styles.sharePanel}>
      <div className={styles.shareHeading}>
        <QrCode className="size-4" aria-hidden="true" />
        <h2>QR Code e link</h2>
        {active && <Badge variant="success">Aberto</Badge>}
      </div>
      {access ? (
        <>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => void copy()} disabled={pending}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
            <Button variant="ghost" onClick={() => setShowQr(!showQr)} aria-expanded={showQr}>
              {showQr ? "Ocultar QR" : "Mostrar QR"}
            </Button>
          </div>
          {showQr && (
            <div className={styles.qr}>
              <QRCodeSVG
                value={access.url}
                size={240}
                marginSize={4}
                level="M"
                title="QR Code para confirmar presença nesta aula"
              />
              <p className={styles.hint}>Disponível até {attendanceTime(access.expiresAt)}</p>
            </div>
          )}
          {copyError && (
            <div className="grid min-w-0 gap-2">
              <p className={styles.hint}>Selecione o endereço para copiar:</p>
              <Input
                readOnly
                value={access.url}
                aria-label="Link de presença do aluno"
                onFocus={(event) => event.target.select()}
              />
            </div>
          )}
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={<a href={access.url} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink aria-hidden="true" /> Página do aluno
            </Button>
            {projectionUrl && (
              <Button
                variant="secondary"
                size="sm"
                nativeButton={false}
                render={<a href={projectionUrl} target="_blank" rel="noreferrer" />}
              >
                <Monitor aria-hidden="true" /> Projetar QR
              </Button>
            )}
          </div>
          <div className={styles.actions}>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || Boolean(status.restriction)}
              onClick={generate}
            >
              <RefreshCw aria-hidden="true" /> Renovar QR e link
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={close}>
              Encerrar link
            </Button>
          </div>
        </>
      ) : status.restriction ? (
        <p className={styles.hint}>{status.restriction}</p>
      ) : (
        <>
          {previousLink && !active && (
            <p className={styles.hint}>
              O acesso anterior encerrou. Gere outro para continuar recebendo presenças.
            </p>
          )}
          <QrWindowForm
            minutes={minutes}
            change={setMinutes}
            active={Boolean(active)}
            format={status.format}
            submit={generate}
          />
          <Button variant="secondary" type="submit" form="open-attendance-link" disabled={pending}>
            <QrCode aria-hidden="true" />
            {generating ? "Gerando…" : active ? "Gerar novo QR e link" : "Gerar QR Code e link"}
          </Button>
        </>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
      {!url && (
        <a className={styles.link} href="/presenca/previa" target="_blank" rel="noreferrer">
          Conhecer a página do aluno
        </a>
      )}
    </section>
  );
}
