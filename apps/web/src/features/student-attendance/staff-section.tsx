"use client";
import { useState, type ReactElement } from "react";
import { QrCode } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Alert, Badge, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { AttendanceQrDialog, type QrLink } from "./qr-dialog";
import { attendanceTime } from "./location";
export type AttendanceStatus = RouterOutputs["studentAttendance"]["status"];
export function StudentAttendanceSection({
  sessionId,
  status,
  failed,
  refresh,
}: {
  sessionId: string;
  status: AttendanceStatus | undefined;
  failed: boolean;
  refresh: () => void;
}): ReactElement | null {
  const [dialog, setDialog] = useState(false);
  const [link, setLink] = useState<QrLink | null>(null);
  const utils = trpc.useUtils();
  const close = trpc.studentAttendance.close.useMutation({
    onSuccess: async () => {
      setLink(null);
      await utils.studentAttendance.status.invalidate({ sessionId });
      await utils.activity.invalidate();
    },
  });
  if (failed)
    return (
      <Alert>
        Não foi possível consultar os envios dos alunos.{" "}
        <Button variant="ghost" onClick={refresh}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (!status) return null;
  const active = status.windows.find((row) => row.active);
  const currentLink = active?.id === link?.id ? link : null;
  return (
    <section
      className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-5"
      aria-label="Presença pelo aluno"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <QrCode className="size-4" aria-hidden="true" />
            Presença pelo aluno
            {active && (
              <Badge variant="success">Aberto até {attendanceTime(active.expiresAt)}</Badge>
            )}
          </h2>
          <p className="text-caption text-muted-foreground">
            {status.declarations.length
              ? `${status.declarations.length} ${status.declarations.length === 1 ? "envio recebido" : "envios recebidos"}. Confira cada presença na chamada.`
              : "Os envios por QR ou link aparecem aqui para revisão."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {active && (
            <Button
              variant="ghost"
              size="sm"
              disabled={close.isPending}
              onClick={() => close.mutate({ sessionId })}
            >
              {close.isPending ? "Encerrando…" : "Encerrar link"}
            </Button>
          )}
          {!status.restriction && (
            <Button variant="secondary" size="sm" onClick={() => setDialog(true)}>
              {currentLink ? "Mostrar QR / link" : active ? "Gerar novo link" : "Abrir QR / link"}
            </Button>
          )}
        </div>
      </div>
      {status.restriction && !status.windows.length && (
        <p className="text-caption text-muted-foreground">{status.restriction}</p>
      )}
      {close.error && <Alert variant="destructive">{close.error.message}</Alert>}
      {status.declarations.length > 0 && (
        <details>
          <summary className="cursor-pointer text-caption text-interactive">
            Conferir envios recebidos
          </summary>
          <ul className="mt-3 grid divide-y divide-border">
            {status.declarations.map((row) => (
              <li key={row.id} className="grid gap-1 py-3 sm:grid-cols-2">
                <span className="text-sm font-medium">{row.name}</span>
                <DeclarationEvidence value={row} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {status.windows.length > 0 && (
        <details>
          <summary className="cursor-pointer text-caption text-muted-foreground">
            Aberturas e encerramentos
          </summary>
          <ol className="mt-3 grid gap-3 text-caption text-muted-foreground">
            {status.windows.map((row) => (
              <li key={row.id}>
                <span className="font-medium text-foreground">
                  {attendanceTime(row.openedAt)} · {row.openedBy.name}
                </span>
                <p>
                  Envios até {attendanceTime(row.expiresAt)}
                  {row.closedAt
                    ? ` · Encerrado às ${attendanceTime(row.closedAt)}${row.closedBy ? ` por ${row.closedBy.name}` : ""}`
                    : row.active
                      ? " · Aberto"
                      : " · Expirado"}
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
      {dialog && (
        <AttendanceQrDialog
          sessionId={sessionId}
          format={status.format}
          active={Boolean(active)}
          link={currentLink}
          setLink={setLink}
          onClose={() => setDialog(false)}
        />
      )}
    </section>
  );
}
export function DeclarationEvidence({
  value,
}: {
  value: AttendanceStatus["declarations"][number];
}): ReactElement {
  return (
    <p className="text-caption text-muted-foreground">
      Enviado às {attendanceTime(value.submittedAt)}
      {value.format === "ONLINE"
        ? " · Link online"
        : ` · Localização ±${Math.round(value.accuracy ?? 0)} m`}
      {value.distance !== null
        ? ` · Aprox. ${value.distance} m da referência${value.referenceAccuracy !== null ? ` (±${Math.round(value.referenceAccuracy)} m)` : ""}`
        : ""}
    </p>
  );
}
