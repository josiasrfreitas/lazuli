"use client";
import { useEffect, useState, type ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, Monitor, QrCode, RefreshCw } from "lucide-react";
import { ToastAlert, Badge, Button, Input } from "@lazuli/ui";
import type { ONLINE_WINDOW_MINUTES } from "@lazuli/validators";
import { QrWindowForm } from "./qr-fields";
import { attendanceTime } from "./location";
import type { AttendanceStatus } from "./staff-section";
import styles from "./teacher-page.module.css";
export type AttendanceShareAccess = { url: string; projectionUrl: string | null; expiresAt: Date };
type Props = {
  status: Pick<AttendanceStatus, "format" | "restriction"> & { active: boolean };
  access: AttendanceShareAccess | null;
  previousLink: boolean;
  pending: boolean;
  generating: boolean;
  error: string | undefined;
  minutes: (typeof ONLINE_WINDOW_MINUTES)[number];
  setMinutes: (value: (typeof ONLINE_WINDOW_MINUTES)[number]) => void;
  generate: () => void;
  close: () => void;
};
export function AttendanceShareControls(props: Props): ReactElement {
  return (
    <section className={styles.sharePanel}>
      <div className={styles.shareHeading}>
        <QrCode className="size-4" aria-hidden />
        <h2>QR Code e link</h2>
        {props.status.active && <Badge variant="success">Aberto</Badge>}
      </div>
      <SharingContent {...props} />
      {props.status.active && !props.access && (
        <Button type="button" variant="ghost" disabled={props.pending} onClick={props.close}>
          Encerrar link
        </Button>
      )}
      {props.error && <ToastAlert variant="destructive">{props.error}</ToastAlert>}
    </section>
  );
}
function SharingContent(props: Props): ReactElement {
  if (props.access) return <ActiveShare {...props} access={props.access} />;
  if (props.status.restriction) return <p className={styles.hint}>{props.status.restriction}</p>;
  let label = "Gerar QR Code e link";
  if (props.generating) label = "Gerando…";
  else if (props.status.active) label = "Gerar novo QR e link";
  return (
    <>
      {props.previousLink && !props.status.active && (
        <p className={styles.hint}>
          O acesso anterior encerrou. Gere outro para continuar recebendo presenças.
        </p>
      )}
      <QrWindowForm
        minutes={props.minutes}
        change={props.setMinutes}
        active={props.status.active}
        format={props.status.format}
        submit={props.generate}
      />
      <Button variant="primary" type="submit" form="open-attendance-link" disabled={props.pending}>
        <QrCode aria-hidden />
        {label}
      </Button>
    </>
  );
}
function ActiveShare(props: Props & { access: AttendanceShareAccess }): ReactElement {
  const { copied, copyError, copy } = useCopyLink(props.access);
  const [showQr, setShowQr] = useState(true);
  useEffect(() => setShowQr(true), [props.access.url, props.access.expiresAt]);
  const url = props.access.url;
  return (
    <>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => void copy()} disabled={props.pending}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Link copiado" : "Copiar link"}
        </Button>
        <Button variant="ghost" onClick={() => setShowQr(!showQr)} aria-expanded={showQr}>
          {showQr ? "Ocultar QR" : "Mostrar QR"}
        </Button>
      </div>
      {showQr && (
        <div className={styles.qr}>
          <QRCodeSVG
            value={url}
            size={QR_SIZE}
            marginSize={QUIET_ZONE}
            level="M"
            title="QR Code para confirmar presença nesta aula"
          />
          <p className={styles.hint}>Disponível até {attendanceTime(props.access.expiresAt)}</p>
        </div>
      )}
      {copyError && <CopyFallback url={url} />}
      <AccessLinks access={props.access} pending={props.pending} />
      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          disabled={props.pending || Boolean(props.status.restriction)}
          onClick={props.generate}
        >
          <RefreshCw aria-hidden />
          Renovar QR e link
        </Button>
        <Button variant="ghost" size="sm" disabled={props.pending} onClick={props.close}>
          Encerrar link
        </Button>
      </div>
    </>
  );
}
const QR_SIZE = 240;
const QUIET_ZONE = 4;
function AccessLinks({
  access,
  pending,
}: {
  access: AttendanceShareAccess;
  pending: boolean;
}): ReactElement {
  return (
    <div className={styles.actions}>
      <Button
        variant="secondary"
        size="sm"
        nativeButton={false}
        disabled={pending}
        render={<a href={access.url} target="_blank" rel="noreferrer" />}
      >
        <ExternalLink aria-hidden />
        Página do aluno
      </Button>
      {access.projectionUrl && (
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={<a href={access.projectionUrl} target="_blank" rel="noreferrer" />}
        >
          <Monitor aria-hidden />
          Projetar QR
        </Button>
      )}
    </div>
  );
}

function useCopyLink(access: AttendanceShareAccess): {
  copied: boolean;
  copyError: boolean;
  copy: () => Promise<void>;
} {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    setCopied(false);
    setCopyError(false);
  }, [access.url, access.expiresAt]);
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(access.url);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return { copied, copyError, copy };
}

function CopyFallback({ url }: { url: string }): ReactElement {
  return (
    <div className="grid gap-2">
      <p className={styles.hint}>Selecione o endereço para copiar:</p>
      <Input
        readOnly
        value={url}
        aria-label="Link de presença do aluno"
        onFocus={(event) => event.target.select()}
      />
    </div>
  );
}
