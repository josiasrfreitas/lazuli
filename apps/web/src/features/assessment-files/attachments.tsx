"use client";
import { useState, type ReactElement, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, FileText, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Input, PencilLoader } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { PHASE_LABELS } from "~/features/assessments/shared";
import type { RouterOutputs } from "@lazuli/api";
import styles from "./attachments.module.css";
export type FileRow = RouterOutputs["assessmentFiles"]["list"][number];
const MIN_REASON = 3;
const status: Record<FileRow["status"], string> = {
  UPLOADING: "Recebimento pendente",
  RECEIVED: "Recebido · na fila",
  PROCESSING: "Processando",
  READY: "Disponível",
  FAILED: "Falha · consulte a fila",
  REJECTED: "Formato inválido",
  REMOVED: "Retirado",
};
type FileListProps = {
  rows: FileRow[];
  refresh: () => void;
  allowRemove?: boolean;
  showPhase?: boolean;
  identify?: boolean;
};
type Removal = {
  isPending: boolean;
  reset: () => void;
  mutate: (input: { id: string; reason: string }) => void;
};
type Identification = {
  isPending: boolean;
  mutate: (input: { id: string; competence: "WRITTEN" | "LISTENING" }) => void;
};
type FileItemProps = {
  row: FileRow;
  allowRemove: boolean;
  showPhase: boolean;
  identify: boolean;
  canManage: boolean;
  removing: string | null;
  reason: string;
  remove: Removal;
  identifyFile: Identification;
  setReason: Dispatch<SetStateAction<string>>;
  setRemoving: Dispatch<SetStateAction<string | null>>;
};
export function AppointmentAssessmentFiles({
  id,
  studentId,
}: {
  id: string;
  studentId: string;
}): ReactElement {
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
}: FileListProps): ReactElement {
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
        <FileItem
          key={row.id}
          row={row}
          allowRemove={allowRemove}
          showPhase={showPhase}
          identify={identify}
          canManage={Boolean(
            me.data && (me.data.role !== "TEACHER" || row.uploadedById === me.data.id),
          )}
          removing={removing}
          reason={reason}
          remove={remove}
          identifyFile={identifyFile}
          setReason={setReason}
          setRemoving={setRemoving}
        />
      ))}
      {identifyFile.error && <Alert variant="destructive">{identifyFile.error.message}</Alert>}
      {remove.error && <Alert variant="destructive">{remove.error.message}</Alert>}
    </div>
  );
}
function FileItem(props: FileItemProps): ReactElement {
  const { row, allowRemove, showPhase, canManage, removing, remove, setRemoving, setReason } =
    props;
  return (
    <div>
      <div className={styles.file}>
        <FileText aria-hidden="true" />
        <FileIdentity row={row} showPhase={showPhase} />
        {allowRemove && removing !== row.id && canManage && (
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
      <FileIdentification {...props} />
      {allowRemove && removing === row.id && <FileRemoval {...props} />}
    </div>
  );
}
function fileBadgeVariant(row: FileRow): "success" | "warning" | "neutral" {
  if (row.status === "READY") return "success";
  return row.status === "FAILED" || row.status === "REJECTED" ? "warning" : "neutral";
}
function FileIdentity({ row, showPhase }: Pick<FileItemProps, "row" | "showPhase">): ReactElement {
  return (
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
        <Badge variant={fileBadgeVariant(row)}>{status[row.status]}</Badge>
      </div>
    </div>
  );
}
function FileIdentification({
  row,
  identify,
  canManage,
  identifyFile,
}: FileItemProps): ReactElement | null {
  if (!identify || row.competence || !canManage) return null;
  return (
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
  );
}
function FileRemoval({ row, reason, setReason, setRemoving, remove }: FileItemProps): ReactElement {
  return (
    <div className={styles.removal}>
      <Input
        aria-label="Motivo da retirada"
        name={`remove-${row.id}`}
        autoComplete="off"
        size="sm"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (!remove.isPending && reason.trim().length >= MIN_REASON)
            remove.mutate({ id: row.id, reason: reason.trim() });
        }}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Motivo da retirada"
        required
        minLength={MIN_REASON}
        disabled={remove.isPending}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="destructive-outline"
          disabled={remove.isPending || reason.trim().length < MIN_REASON}
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
  );
}
