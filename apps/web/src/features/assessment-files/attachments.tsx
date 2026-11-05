"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, FileText, Trash2 } from "lucide-react";
import { ToastAlert, Badge, Button, Input, PencilLoader } from "@lazuli/ui";
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
      {query.error && <ToastAlert variant="destructive">{query.error.message}</ToastAlert>}
    </section>
  );
}

type FileListProps = {
  rows: FileRow[];
  refresh: () => void;
  allowRemove?: boolean;
  showPhase?: boolean;
  identify?: boolean;
};

type FileItemProps = {
  row: FileRow;
  showPhase: boolean;
  canRemove: boolean;
  canIdentify: boolean;
  removing: boolean;
  reason: string;
  removePending: boolean;
  identifyPending: boolean;
  onBeginRemove: () => void;
  onCancelRemove: () => void;
  onReasonChange: (reason: string) => void;
  onRemove: () => void;
  onIdentify: (competence: "WRITTEN" | "LISTENING") => void;
};
type FileRowsController = {
  showPhase: boolean;
  allowRemove: boolean;
  identify: boolean;
  removing: string | null;
  reason: string;
  removePending: boolean;
  identifyPending: boolean;
  canManage: (row: FileRow) => boolean;
  beginRemove: (id: string) => void;
  cancelRemove: () => void;
  setReason: (reason: string) => void;
  remove: (id: string) => void;
  identifyFile: (id: string, competence: "WRITTEN" | "LISTENING") => void;
};

export function FileList({
  rows,
  refresh,
  allowRemove = true,
  showPhase = true,
  identify = false,
}: FileListProps): ReactJSX.Element {
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
  const controller: FileRowsController = {
    showPhase,
    allowRemove,
    identify,
    removing,
    reason,
    removePending: remove.isPending,
    identifyPending: identifyFile.isPending,
    canManage: (row) =>
      Boolean(me.data && (me.data.role !== "TEACHER" || row.uploadedById === me.data.id)),
    beginRemove: (id) => {
      setReason("");
      remove.reset();
      setRemoving(id);
    },
    cancelRemove: () => setRemoving(null),
    setReason,
    remove: (id) => remove.mutate({ id, reason: reason.trim() }),
    identifyFile: (id, competence) => identifyFile.mutate({ id, competence }),
  };
  return (
    <FileListBody
      rows={rows}
      controller={controller}
      identifyError={identifyFile.error?.message}
      removeError={remove.error?.message}
    />
  );
}

function FileListBody({
  rows,
  controller,
  identifyError,
  removeError,
}: {
  rows: FileRow[];
  controller: FileRowsController;
  identifyError?: string | undefined;
  removeError?: string | undefined;
}): ReactJSX.Element {
  return (
    <div className={styles.list}>
      {rows.length === 0 && (
        <p className="text-caption text-muted-foreground">Nenhuma prova anexada.</p>
      )}
      <FileRows rows={rows} controller={controller} />
      <FileListErrors identifyError={identifyError} removeError={removeError} />
    </div>
  );
}

function FileListErrors({
  identifyError,
  removeError,
}: {
  identifyError?: string | undefined;
  removeError?: string | undefined;
}): ReactJSX.Element {
  return (
    <>
      {identifyError && <ToastAlert variant="destructive">{identifyError}</ToastAlert>}
      {removeError && <ToastAlert variant="destructive">{removeError}</ToastAlert>}
    </>
  );
}

function FileRows({
  rows,
  controller,
}: {
  rows: FileRow[];
  controller: FileRowsController;
}): ReactJSX.Element {
  return (
    <>
      {rows.map((row) => {
        const canManage = controller.canManage(row);
        return (
          <FileItem
            key={row.id}
            row={row}
            showPhase={controller.showPhase}
            canRemove={controller.allowRemove && canManage}
            canIdentify={controller.identify && !row.competence && canManage}
            removing={controller.allowRemove && controller.removing === row.id}
            reason={controller.reason}
            removePending={controller.removePending}
            identifyPending={controller.identifyPending}
            onBeginRemove={() => controller.beginRemove(row.id)}
            onCancelRemove={controller.cancelRemove}
            onReasonChange={controller.setReason}
            onRemove={() => controller.remove(row.id)}
            onIdentify={(competence) => controller.identifyFile(row.id, competence)}
          />
        );
      })}
    </>
  );
}

function FileItem(props: FileItemProps): ReactJSX.Element {
  const {
    row,
    showPhase,
    canRemove,
    canIdentify,
    removing,
    reason,
    removePending,
    identifyPending,
    onBeginRemove,
    onCancelRemove,
    onReasonChange,
    onRemove,
    onIdentify,
  } = props;
  return (
    <div>
      <FileIdentity
        row={row}
        showPhase={showPhase}
        canRemove={canRemove && !removing}
        removePending={removePending}
        onBeginRemove={onBeginRemove}
      />
      {canIdentify && <FileIdentify pending={identifyPending} onIdentify={onIdentify} />}
      {removing && (
        <FileRemoval
          reason={reason}
          pending={removePending}
          onReasonChange={onReasonChange}
          onRemove={onRemove}
          onCancel={onCancelRemove}
        />
      )}
    </div>
  );
}

function fileBadgeVariant(value: FileRow["status"]): "success" | "warning" | "neutral" {
  if (value === "READY") return "success";
  if (value === "FAILED" || value === "REJECTED") return "warning";
  return "neutral";
}

function FileIdentity({
  row,
  showPhase,
  canRemove,
  removePending,
  onBeginRemove,
}: {
  row: FileRow;
  showPhase: boolean;
  canRemove: boolean;
  removePending: boolean;
  onBeginRemove: () => void;
}): ReactJSX.Element {
  return (
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
          <Badge variant={fileBadgeVariant(row.status)}>{status[row.status]}</Badge>
        </div>
      </div>
      {canRemove && (
        <Button
          size="icon-compact-responsive"
          variant="ghost"
          aria-label={`Retirar ${row.fileName}`}
          title="Retirar anexo"
          disabled={removePending}
          onClick={onBeginRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

function FileIdentify({
  pending,
  onIdentify,
}: {
  pending: boolean;
  onIdentify: (competence: "WRITTEN" | "LISTENING") => void;
}): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <span className="text-caption text-muted-foreground">Tipo de prova:</span>
      {(["WRITTEN", "LISTENING"] as const).map((competence) => (
        <Button
          key={competence}
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => onIdentify(competence)}
        >
          <Check aria-hidden="true" />
          {competence === "WRITTEN" ? "Written" : "Listening"}
        </Button>
      ))}
    </div>
  );
}

function FileRemoval({
  reason,
  pending,
  onReasonChange,
  onRemove,
  onCancel,
}: {
  reason: string;
  pending: boolean;
  onReasonChange: (reason: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}): ReactJSX.Element {
  return (
    <div className={styles.removal}>
      <Input
        aria-label="Motivo da retirada"
        size="dense"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (!pending && reason.trim().length >= MIN_REMOVAL_REASON_LENGTH) onRemove();
        }}
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        placeholder="Motivo da retirada"
        required
        minLength={3}
        disabled={pending}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="destructive-outline"
          disabled={pending || reason.trim().length < MIN_REMOVAL_REASON_LENGTH}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
          Retirar
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          <ArrowLeft aria-hidden="true" />
          Voltar
        </Button>
      </div>
    </div>
  );
}
