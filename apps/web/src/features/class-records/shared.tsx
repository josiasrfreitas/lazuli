import { RefreshCw } from "lucide-react";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import type { ClassRecordContent, ClassRecordSnapshot } from "@lazuli/validators";
import { ToastAlert, Badge, Button } from "@lazuli/ui";
import { QueryLoading } from "~/components/query-loading";
export { formatDateOnlyBR as dateLabel } from "~/lib/format";
export type ClassRecord = RouterOutputs["classRecords"]["detail"];
export const attendanceLabel = (present: number, total: number): string =>
  `${present} ${present === 1 ? "presente" : "presentes"} · ${total - present} ${total - present === 1 ? "falta" : "faltas"}`;
export const kindLabels = {
  CONTENT: "Conteúdo",
  REVIEW: "Revisão",
  ASSESSMENT: "Avaliação",
  ACTIVITY: "Atividade",
} as const;
export function RecordState({
  pending,
  error,
  retry,
  label = "Carregando registro",
}: {
  pending: boolean;
  error: { message: string } | null;
  retry: () => void;
  label?: string;
}): ReactElement | null {
  if (pending) return <QueryLoading label={label} />;
  return error ? (
    <ToastAlert variant="destructive">
      <span>{error.message}</span>
      <Button variant="secondary" onClick={retry}>
        <RefreshCw aria-hidden="true" />
        Tentar novamente
      </Button>
    </ToastAlert>
  ) : null;
}
export function PlannedReference({
  value,
}: {
  value: ClassRecordSnapshot["sharedPlanned"];
}): ReactElement {
  if (!value?.items.length)
    return (
      <p className="text-caption text-muted-foreground">
        {value
          ? `Nenhuma atividade prevista para esta data · plano v${value.version}.`
          : "Sem plano registrado até este encontro."}
      </p>
    );
  return (
    <aside className="grid gap-3 rounded-md border border-border bg-muted p-4">
      <h3 className="text-caption font-semibold">
        Previsto para este encontro · versão {value.version}
      </h3>
      <ul className="grid gap-3">
        {value.items.map((item) => (
          <li key={item.id} className="grid gap-1 text-caption">
            <span className="font-medium">{item.title}</span>
            <span className="text-muted-foreground">
              {kindLabels[item.kind]}
              {item.reference ? ` · ${item.reference}` : ""}
              {item.pageFrom === null
                ? ""
                : ` · pág. ${item.pageFrom}${item.pageTo && item.pageTo !== item.pageFrom ? `–${item.pageTo}` : ""}`}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function PerformedContent({ value }: { value: ClassRecordContent }): ReactElement {
  return (
    <div className="grid gap-2">
      <Badge variant="neutral">{kindLabels[value.kind]}</Badge>
      {value.planItemId && (
        <p className="text-caption">
          {value.planItemTitle ?? "Etapa do planejamento"} ·{" "}
          {value.planItemStatus === "COMPLETED" ? "Concluída" : "Em andamento"}
        </p>
      )}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{value.account}</p>
      {(value.reference || value.pageFrom !== null) && (
        <p className="text-caption text-muted-foreground">
          {value.reference}
          {value.pageFrom === null
            ? ""
            : `${value.reference ? " · " : ""}Pág. ${value.pageFrom}${value.pageTo !== null && value.pageTo !== value.pageFrom ? `–${value.pageTo}` : ""}`}
        </p>
      )}
    </div>
  );
}
export function SnapshotView({
  snapshot,
  draft = false,
}: {
  snapshot: ClassRecordSnapshot;
  draft?: boolean;
}): ReactElement {
  const present = snapshot.entries.filter((row) => row.status === "PRESENT").length;
  return (
    <div className="grid min-w-0 gap-5">
      <p className="text-caption text-muted-foreground">
        {draft
          ? `${snapshot.entries.length} alunos · chamada por confirmar`
          : attendanceLabel(present, snapshot.entries.length)}
      </p>
      {snapshot.sharedContent && (
        <section className="grid gap-4">
          <h3 className="text-sm font-semibold">Realizado pela turma</h3>
          <PerformedContent value={snapshot.sharedContent} />
          <PlannedReference value={snapshot.sharedPlanned} />
        </section>
      )}
      <div className="divide-y divide-border rounded-md border border-border">
        {snapshot.entries.map((row) => (
          <article key={row.enrollmentId} className="grid gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{row.name}</h3>
                {row.stage && <p className="text-caption text-muted-foreground">{row.stage}</p>}
              </div>
              <SnapshotAttendance status={row.status} draft={draft} />
            </div>
            {row.content && (
              <>
                <PerformedContent value={row.content} />
                <PlannedReference value={row.planned} />
              </>
            )}
          </article>
        ))}
      </div>
      {snapshot.note && (
        <section className="grid gap-2">
          <h3 className="text-caption font-semibold">Observação da aula</h3>
          <p className="whitespace-pre-wrap text-sm">{snapshot.note}</p>
        </section>
      )}
    </div>
  );
}

function SnapshotAttendance({
  status,
  draft,
}: {
  status: "PRESENT" | "ABSENT";
  draft: boolean;
}): ReactElement {
  if (draft) return <Badge variant="neutral">Por confirmar</Badge>;
  return (
    <Badge variant={status === "PRESENT" ? "success" : "warning"}>
      {status === "PRESENT" ? "Presente" : "Falta"}
    </Badge>
  );
}
