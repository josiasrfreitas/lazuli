"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, FileText, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Input, PencilLoader } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { PHASE_LABELS } from "~/features/assessments/shared";
import type { RouterOutputs } from "@lazuli/api";
import styles from "./attachments.module.css";

const MIN_REMOVAL_REASON_LENGTH = 3;

export type FileRow = RouterOutputs["assessmentFiles"]["list"][number];
const status: Record<FileRow["status"], string> = {
  UPLOADING: "Recebimento pendente",
  RECEIVED: "Recebido · na fila",
  PROCESSING: "Processando",
  READY: "Disponível",
  FAILED: "Falha · consulte a fila",
  REJECTED: "Formato inválido",
  REMOVED: "Retirado",
};

export function AppointmentAssessmentFiles({
  id,
  studentId,
}: {
  id: string;
  studentId: string;
}): ReactJSX.Element {
  const query = trpc.assessmentFiles.appointment.useQuery({ id });
  const me = trpc.me.useQuery();
  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <h3>Notas e provas</h3>
        <Button
          variant="link"
          size="sm"
          nativeButton={false}
          render={
            <Link
              href={
                me.data?.role === "TEACHER"
                  ? `/professor/alunos/${studentId}?secao=notas`
                  : `/alunos/${studentId}`
              }
            />
          }
        >
          <ArrowUpRight aria-hidden="true" />
          Abrir avaliações
        </Button>
      </div>
      {query.isPending && <PencilLoader size="sm" label="Consultando provas" />}
      {query.data && query.data.length > 0 && (
        <FileList rows={query.data} refresh={() => void query.refetch()} />
      )}
      {query.error && <Alert variant="destructive">{query.error.message}</Alert>}
    </section>
  );
}

export function FileList({
  rows,
  refresh,
  allowRemove = true,
  showPhase = true,
  identify = false,
}: {
  rows: FileRow[];
  refresh: () => void;
  allowRemove?: boolean;
  showPhase?: boolean;
  identify?: boolean;
}): ReactJSX.Element {
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
  const identifyFile = trpc.assessmentFiles.identify.useMutation({ onSuccess: refresh });
  return (
    <div className={styles.list}>
      {rows.length === 0 && (
        <p className="text-caption text-muted-foreground">Nenhuma prova anexada.</p>
      )}
      {rows.map((row) => (
        <div key={row.id}>
          <div className={styles.file}>
            <FileText aria-hidden="true" />
            <div className={styles.identity}>
              {row.status === "READY" ? (
                <a
                  className={styles.filename}
                  href={`/api/assessment-files/${row.id}`}
                  aria-label={`Baixar ${row.fileName}`}
                >
                  {row.fileName}
                </a>
              ) : (
                <p className={styles.filename}>{row.fileName}</p>
              )}
              <div className={styles.metadata}>
                {showPhase && <span>{PHASE_LABELS[row.phase]}</span>}
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
            </div>
            {allowRemove &&
              removing !== row.id &&
              me.data &&
              (me.data.role !== "TEACHER" || row.uploadedById === me.data.id) && (
                <Button
                  size="icon-compact-responsive"
                  variant="ghost"
                  aria-label={`Retirar ${row.fileName}`}
                  title="Retirar anexo"
                  disabled={remove.isPending}
                  onClick={() => {
                    setReason("");
                    remove.reset();
                    setRemoving(row.id);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
          </div>
          {identify &&
            !row.competence &&
            me.data &&
            (me.data.role !== "TEACHER" || row.uploadedById === me.data.id) && (
              <div className="flex flex-wrap items-center gap-2 py-1">
                <span className="text-caption text-muted-foreground">Tipo de prova:</span>
                {(["WRITTEN", "LISTENING"] as const).map((competence) => (
                  <Button
                    key={competence}
                    size="sm"
                    variant="secondary"
                    disabled={identifyFile.isPending}
                    onClick={() => identifyFile.mutate({ id: row.id, competence })}
                  >
                    <Check aria-hidden="true" />
                    {competence === "WRITTEN" ? "Written" : "Listening"}
                  </Button>
                ))}
              </div>
            )}
          {allowRemove && removing === row.id && (
            <div className={styles.removal}>
              <Input
                aria-label="Motivo da retirada"
                size="dense"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (!remove.isPending && reason.trim().length >= MIN_REMOVAL_REASON_LENGTH)
                    remove.mutate({ id: row.id, reason: reason.trim() });
                }}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Motivo da retirada"
                required
                minLength={3}
                disabled={remove.isPending}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="destructive-outline"
                  disabled={remove.isPending || reason.trim().length < MIN_REMOVAL_REASON_LENGTH}
                  onClick={() => remove.mutate({ id: row.id, reason: reason.trim() })}
                >
                  <Trash2 aria-hidden="true" />
                  Retirar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => setRemoving(null)}
                >
                  <ArrowLeft aria-hidden="true" />
                  Voltar
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      {identifyFile.error && <Alert variant="destructive">{identifyFile.error.message}</Alert>}
      {remove.error && <Alert variant="destructive">{remove.error.message}</Alert>}
    </div>
  );
}
