"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Alert,
  Button,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { AttendanceSharePanel } from "./share-panel";
import { AttendanceWindowHistory } from "./window-history";
import { attendanceTime } from "./location";
export type AttendanceStatus = RouterOutputs["studentAttendance"]["status"];
const DECLARATION_POLL_MS = 5000;
export function StudentAttendanceSection({ sessionId }: { sessionId: string }): ReactElement {
  const [open, setOpen] = useState(false);
  const query = trpc.studentAttendance.status.useQuery(
    { sessionId },
    { refetchInterval: DECLARATION_POLL_MS },
  );
  const count = query.data?.declarations.length ?? 0;
  return (
    <section
      className="grid gap-3 rounded-lg border border-border p-4"
      aria-label="Declarações de presença"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {count} {count === 1 ? "declaração recebida" : "declarações recebidas"} · confirme
          presença e relato no registro da aula.
        </p>
        <Button variant="secondary" onClick={() => setOpen(true)} disabled={!query.data}>
          <QrCode aria-hidden /> QR e link
        </Button>
      </div>
      {query.error && <Alert>{query.error.message}</Alert>}
      <DeclarationEvidence entries={query.data?.declarations ?? []} />
      {query.data && <AttendanceWindowHistory windows={query.data.windows} />}
      <AttendanceSettingsLink />
      <SharingDialog open={open} setOpen={setOpen} status={query.data} sessionId={sessionId} />
    </section>
  );
}

function SharingDialog({
  open,
  setOpen,
  status,
  sessionId,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  status: AttendanceStatus | undefined;
  sessionId: string;
}): ReactElement {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR e link de presença</DialogTitle>
            <DialogDescription>
              Receba declarações sem alterar a chamada. Revise o resultado junto ao relato da aula.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-4">
            {status && (
              <AttendanceSharePanel sessionId={sessionId} status={status} disabled={false} />
            )}
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function DeclarationEvidence({
  entries,
}: {
  entries: AttendanceStatus["declarations"];
}): ReactElement {
  return (
    <>
      {entries.map((entry) => (
        <p key={entry.id} className="text-caption text-muted-foreground">
          {entry.name} · {attendanceTime(entry.submittedAt)} ·{" "}
          {entry.format === "ONLINE"
            ? "Online"
            : `Presencial · precisão ${entry.accuracy ?? "—"} m · distância ${entry.distance ?? "—"} m`}
        </p>
      ))}
    </>
  );
}

function AttendanceSettingsLink(): ReactElement | null {
  const me = trpc.me.useQuery();
  if (me.data?.role !== "ADMIN" && me.data?.role !== "SYSTEM_ADMIN") return null;
  return (
    <Link
      href="/configuracoes/presenca"
      className="w-fit text-caption text-interactive hover:underline"
    >
      Configurar área da escola
    </Link>
  );
}
