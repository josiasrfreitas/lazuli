"use client";
import Link from "next/link";
import { studentFollowUpHref } from "./student-navigation";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { ToastAlert, Button, EmptyState } from "@lazuli/ui";
import { QueryLoading } from "~/components/query-loading";
import { ArrowLeft, ArrowUpRight, MessagesSquare, RefreshCw } from "lucide-react";
export type Occurrence = RouterOutputs["occurrences"]["byId"];
export type Intervention = RouterOutputs["interventions"]["byId"];
export type OccurrenceRow = RouterOutputs["occurrences"]["list"]["rows"][number];
export const OCCURRENCE_STATUS = {
  OPEN: "Aberta",
  FOLLOWING_UP: "Em acompanhamento",
  CLOSED: "Encerrada",
} as const;

export const CATEGORY = {
  MATERIAL: "Material",
  HOMEWORK: "Atividade de casa",
  PARTICIPATION: "Participação",
  BEHAVIOR: "Convivência",
  LEARNING: "Aprendizagem",
  OTHER: "Outro contexto",
} as const;
export function dateLabel(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
export function recordedLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
export function QueryState({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: { message: string } | null;
  retry: () => void;
}): ReactElement | null {
  if (pending) return <QueryLoading label="Carregando acompanhamento" />;
  if (error)
    return (
      <ToastAlert variant="destructive">
        {error.message}
        <Button variant="secondary" onClick={retry}>
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </ToastAlert>
    );
  return null;
}
export function FollowUpEmpty({ kind }: { kind: string }): ReactElement {
  return (
    <EmptyState
      icon={<MessagesSquare />}
      title={`Nenhuma ${kind} encontrada`}
      description="Os registros aparecerão aqui conforme o acompanhamento da equipe. Você também pode ajustar os filtros."
    />
  );
}
export function BackLink(): ReactElement {
  return (
    <Link
      href="/acompanhamento"
      className="inline-flex min-h-11 items-center gap-2 text-caption text-muted-foreground hover:text-interactive"
    >
      <ArrowLeft className="size-4" />
      Acompanhamento
    </Link>
  );
}
export function OccurrenceLink({ row }: { row: OccurrenceRow }): ReactElement {
  return (
    <Link
      href={studentFollowUpHref(row.studentId, { kind: "occurrence", id: row.id })}
      className="group grid gap-2 rounded-md border border-border bg-card p-4 transition-colors hover:border-border-strong focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium text-heading group-hover:text-interactive">{row.title}</span>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="text-caption text-muted-foreground">
        {dateLabel(row.classSession.date)} · {row.classSession.class.portalClassName}
      </p>
      <p className="text-caption text-muted-foreground">
        {CATEGORY[row.category]} · {row.recordedBy.name}
      </p>
    </Link>
  );
}
export function FollowUpTimeline({ rows }: { rows: Intervention["followUps"] }): ReactElement {
  return (
    <ul className="list-disc space-y-4 pl-5 marker:text-muted-foreground">
      {rows.map((row) => (
        <li key={row.id} className="pl-1">
          <div className="grid gap-1">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{row.body}</p>
            <p className="text-caption text-muted-foreground">
              {row.recordedBy.name} ·{" "}
              <time dateTime={row.createdAt.toISOString()}>{recordedLabel(row.createdAt)}</time>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
