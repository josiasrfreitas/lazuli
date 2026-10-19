"use client";
import { useState, type ReactElement } from "react";
import { Link2, Pencil } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { CATEGORY, dateLabel, recordedLabel, QueryState, type Occurrence } from "./shared";
import { OccurrenceEditForm } from "./action-forms";
import { LinkOccurrenceForm } from "./link-form";
import type { SelectFollowUp } from "./student-navigation";
import { DeskDetailLoading } from "./student-desk-loading";
import styles from "./student-desk.module.css";
type OccurrenceAction = "edit" | "link" | null;
type Props = { id: string; studentId: string; select: SelectFollowUp; readOnly?: boolean };
export function DeskOccurrence({ id, studentId, select, readOnly = false }: Props): ReactElement {
  const query = trpc.occurrences.byId.useQuery({ id }, { retry: false });
  if (query.isPending) return <DeskDetailLoading />;
  return (
    <>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data &&
        (query.data.studentId === studentId ? (
          <OccurrenceRecord key={id} row={query.data} select={select} readOnly={readOnly} />
        ) : (
          <p role="alert">Esta ocorrência pertence a outro aluno.</p>
        ))}
    </>
  );
}
function OccurrenceRecord({
  row,
  select,
  readOnly,
}: {
  row: Occurrence;
  select: SelectFollowUp;
  readOnly: boolean;
}): ReactElement {
  const [action, setAction] = useState<OccurrenceAction>(null);
  return (
    <article className={styles.record}>
      <header className={styles.recordHeading}>
        <h3>{row.title}</h3>
        <div className={styles.recordToolbar}>
          <div className={styles.recordMeta}>
            <p>
              Aula de {dateLabel(row.classSession.date)} · {row.classSession.class.portalClassName}
            </p>
            <span aria-hidden="true">·</span>
            <span className={styles.recordType}>Ocorrência</span>
            <Badge variant="neutral">{CATEGORY[row.category]}</Badge>
          </div>
          {!readOnly && (
            <Button size="sm" variant="text" onClick={() => setAction("link")}>
              <Link2 aria-hidden="true" />
              Relacionar ocorrência
            </Button>
          )}
        </div>
      </header>
      <div
        className={styles.recordBody}
        tabIndex={0}
        role="region"
        aria-label="Conteúdo do registro"
      >
        <OccurrenceBody
          row={row}
          select={select}
          onEdit={readOnly ? undefined : () => setAction("edit")}
        />
      </div>
      {action === "edit" && <OccurrenceEditForm row={row} onClose={() => setAction(null)} />}
      {action === "link" && (
        <LinkOccurrenceForm
          studentId={row.studentId}
          target={{ type: "occurrence", id: row.id }}
          exclude={[row.id, ...row.related.map((item) => item.id)]}
          onClose={() => setAction(null)}
        />
      )}
    </article>
  );
}
function OccurrenceBody({
  row,
  select,
  onEdit,
}: {
  row: Occurrence;
  select: SelectFollowUp;
  onEdit?: () => void;
}): ReactElement {
  return (
    <>
      <section className={styles.occurrenceSection}>
        <div className={styles.sectionHeading}>
          <h4>O que aconteceu</h4>
          {onEdit && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Editar relato"
              title="Editar relato"
              onClick={onEdit}
            >
              <Pencil aria-hidden="true" />
            </Button>
          )}
        </div>
        <p>{row.account}</p>
        <small>
          Registrado por {row.recordedBy.name} · {recordedLabel(row.createdAt)}
        </small>
      </section>
      {row.initialResponse && (
        <section className={styles.occurrenceSection}>
          <h4>Ação imediata</h4>
          <p>{row.initialResponse}</p>
        </section>
      )}
      <OccurrenceRelations row={row} select={select} />
    </>
  );
}

function OccurrenceRelations({
  row,
  select,
}: {
  row: Occurrence;
  select: SelectFollowUp;
}): ReactElement {
  return (
    <>
      <section className={styles.occurrenceSection}>
        <h4>Intervenções vinculadas · {row.interventions.length}</h4>
        {row.interventions.map((item) => (
          <button
            key={item.id}
            className={styles.related}
            onClick={() => select({ kind: "intervention", id: item.id })}
          >
            <strong>{item.title}</strong>
            <small>{item.responsible.name}</small>
          </button>
        ))}
        {row.interventions.length === 0 && (
          <p className={styles.muted}>Nenhuma intervenção vinculada.</p>
        )}
      </section>
      {row.related.length > 0 && (
        <section>
          <h4>Ocorrências relacionadas</h4>
          {row.related.map((item) => (
            <button
              key={item.id}
              className={styles.related}
              onClick={() => select({ kind: "occurrence", id: item.id })}
            >
              <small>{dateLabel(item.classSession.date)}</small>
              <strong>{item.title}</strong>
            </button>
          ))}
        </section>
      )}
    </>
  );
}
