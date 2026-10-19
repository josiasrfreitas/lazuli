"use client";
import { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Input } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { PHASE_LABELS } from "~/features/assessments/shared";
import { useAssessmentUploads } from "./queue-provider";
import { formatDateOnlyBR } from "~/lib/format";
import type { RouterOutputs } from "@lazuli/api";

type FileRow = RouterOutputs["assessmentFiles"]["list"][number];
const status: Record<FileRow["status"], string> = {
  UPLOADING: "Recebimento pendente",
  RECEIVED: "Recebido · na fila",
  PROCESSING: "Processando",
  READY: "Disponível",
  FAILED: "Falha · consulte a fila",
  REJECTED: "Formato inválido",
  REMOVED: "Retirado",
};

export function AssessmentAttachments({
  progressId,
  studentId,
  appointmentId,
}: {
  progressId: string;
  studentId: string;
  appointmentId?: string;
}) {
  const query = trpc.assessmentFiles.list.useQuery({ progressId }, { refetchInterval: 5_000 });
  const appointments = trpc.appointments.forStudent.useQuery({ studentId });
  const [phase, setPhase] = useState<"BLOCK_ONE" | "BLOCK_TWO" | "RECOVERY">("BLOCK_ONE");
  const [appointment, setAppointment] = useState(appointmentId ?? "");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const uploads = useAssessmentUploads();
  const eligible =
    appointments.data?.filter(
      (row) => row.purpose === "ASSESSMENT" && row.status !== "CANCELLED",
    ) ?? [];
  return (
    <section
      className="grid min-w-0 gap-4 border-t border-border pt-5"
      aria-label="Provas anexadas"
    >
      <div>
        <h3 className="text-sm font-semibold">Provas · opcional</h3>
        <p className="mt-1 text-caption text-muted-foreground">
          Fotos JPG/PNG ou PDFs, até 20 MB por arquivo. As notas podem ser salvas sem anexos.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectControl
          name={`proof-phase-${progressId}`}
          label="Unidade da prova"
          value={phase}
          onChange={(value) => setPhase(value as typeof phase)}
          choices={Object.entries(PHASE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        {eligible.length > 0 && (
          <SelectControl
            name={`proof-appointment-${progressId}`}
            label="Atendimento de aplicação · opcional"
            value={appointment}
            onChange={setAppointment}
            choices={[
              { value: "", label: "Sem atendimento associado" },
              ...eligible.map((row) => ({
                value: row.id,
                label: `${formatDateOnlyBR(row.date)} · ${row.startTime}`,
              })),
            ]}
          />
        )}
      </div>
      <label className="grid gap-2 text-sm">
        Adicionar arquivos
        <Input
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          disabled={adding}
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            setError("");
            setAdding(true);
            try {
              await uploads.add(files, {
                progressId,
                phase,
                ...(appointment ? { appointmentId: appointment } : {}),
              });
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Não foi possível colocar o arquivo na fila.",
              );
            } finally {
              setAdding(false);
            }
          }}
        />
      </label>
      {error && <Alert variant="destructive">{error}</Alert>}
      {query.error && (
        <Alert variant="destructive">
          Não foi possível consultar os anexos.
          <Button variant="ghost" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      )}
      {query.isPending && (
        <p role="status" className="text-caption">
          Consultando provas…
        </p>
      )}
      {query.data && <FileList rows={query.data} refresh={() => void query.refetch()} />}
    </section>
  );
}

export function AppointmentAssessmentFiles({ id, studentId }: { id: string; studentId: string }) {
  const query = trpc.assessmentFiles.appointment.useQuery({ id });
  const me = trpc.me.useQuery();
  return (
    <section className="grid gap-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Provas deste atendimento</h3>
      <p className="text-caption text-muted-foreground">
        O arquivo é o mesmo disponível em Notas. A conclusão do atendimento não lança uma nota
        automaticamente.
      </p>
      <Link
        className="text-sm text-interactive underline"
        href={
          me.data?.role === "TEACHER"
            ? `/professor/alunos/${studentId}?secao=notas`
            : `/alunos/${studentId}`
        }
      >
        Abrir notas e anexar prova
      </Link>
      {query.data && <FileList rows={query.data} refresh={() => void query.refetch()} />}
      {query.error && <Alert variant="destructive">{query.error.message}</Alert>}
    </section>
  );
}

function FileList({ rows, refresh }: { rows: FileRow[]; refresh: () => void }) {
  const me = trpc.me.useQuery();
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const remove = trpc.assessmentFiles.remove.useMutation({
    onSuccess: () => {
      setRemoving(null);
      setReason("");
      refresh();
    },
  });
  return (
    <div className="grid gap-3">
      {rows.length === 0 && (
        <p className="text-caption text-muted-foreground">Nenhuma prova anexada.</p>
      )}
      {rows.map((row) => (
        <div key={row.id} className="grid gap-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-caption">{PHASE_LABELS[row.phase]}</span>
            <Badge
              variant={
                row.status === "READY"
                  ? "success"
                  : row.status === "FAILED" || row.status === "REJECTED"
                    ? "warning"
                    : "neutral"
              }
            >
              {status[row.status]}
            </Badge>
          </div>
          {row.status === "READY" ? (
            <a
              className="break-all text-sm text-interactive underline"
              href={`/api/assessment-files/${row.id}`}
            >
              {row.fileName} · Baixar
            </a>
          ) : (
            <p className="break-all text-sm">{row.fileName}</p>
          )}
          {removing === row.id ? (
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                remove.mutate({ id: row.id, reason });
              }}
            >
              <Input
                aria-label="Motivo da retirada"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Motivo da retirada"
                required
                minLength={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  type="submit"
                  variant="destructive-outline"
                  disabled={remove.isPending}
                >
                  Confirmar retirada
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>
                  Voltar
                </Button>
              </div>
            </form>
          ) : (
            me.data &&
            (me.data.role !== "TEACHER" || row.uploadedById === me.data.id) && (
              <Button size="sm" variant="ghost" onClick={() => setRemoving(row.id)}>
                Retirar anexo
              </Button>
            )
          )}
        </div>
      ))}
      {remove.error && <Alert variant="destructive">{remove.error.message}</Alert>}
    </div>
  );
}
