"use client";
import { Link2, Pencil } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import {
  dateLabel,
  recordedLabel,
  FollowUpTimeline,
  QueryState,
  type Intervention,
} from "./shared";
import { InterventionFollowUpForm } from "./action-forms";
import { LinkOccurrenceForm } from "./link-form";
import type { SelectFollowUp } from "./student-navigation";
import { DeskDetailLoading } from "./student-desk-loading";
import styles from "./student-desk.module.css";
type Action = "followUp" | "LINK";
type Props = { id: string; studentId: string; select: SelectFollowUp; readOnly?: boolean };
export function DeskIntervention({ id, studentId, select, readOnly = false }: Props): ReactElement {
  const query = trpc.interventions.byId.useQuery({ id }, { retry: false });
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
          <InterventionRecord key={id} row={query.data} select={select} readOnly={readOnly} />
        ) : (
          <p role="alert">Esta intervenção pertence a outro aluno.</p>
        ))}
    </>
  );
}
function InterventionRecord({
  row,
  select,
  readOnly,
}: {
  row: Intervention;
  select: SelectFollowUp;
  readOnly: boolean;
}): ReactElement {
  const [action, setAction] = useState<Action | null>(null);
  return (
    <article className={styles.record}>
      <header className={styles.recordHeading}>
        <h3>{row.title}</h3>
        <div className={styles.recordToolbar}>
          <div className={styles.recordMeta}>
            <p>
              {dateLabel(row.performedOn)} · {row.responsible.name}
            </p>
            <span aria-hidden="true">·</span>
            <span className={styles.recordType}>Intervenção</span>
          </div>
          {!readOnly && <InterventionActions row={row} open={setAction} />}
        </div>
      </header>
      <div
        className={styles.recordBody}
        tabIndex={0}
        role="region"
        aria-label="Conteúdo do registro"
      >
        <InterventionBody row={row} select={select} />
      </div>
      {action === "followUp" && (
        <InterventionFollowUpForm row={row} onClose={() => setAction(null)} />
      )}
      {action === "LINK" && (
        <LinkOccurrenceForm
          studentId={row.studentId}
          target={{ type: "intervention", id: row.id, version: row.version }}
          exclude={row.occurrences.map((item) => item.id)}
          onClose={() => setAction(null)}
        />
      )}
    </article>
  );
}
function InterventionBody({
  row,
  select,
}: {
  row: Intervention;
  select: SelectFollowUp;
}): ReactElement {
  return (
    <>
      <section className={styles.occurrenceSection}>
        <h4>Tratativa realizada</h4>
        <p>{row.treatment}</p>
        <small>
          Registrada por {row.recordedBy.name} · {recordedLabel(row.createdAt)}
        </small>
      </section>
      <section className={styles.occurrenceSection}>
        <h4>Evoluções</h4>
        {row.followUps.length > 0 ? (
          <FollowUpTimeline rows={row.followUps} />
        ) : (
          <p className={styles.muted}>Nenhuma evolução registrada.</p>
        )}
      </section>
      <InterventionSources row={row} select={select} />
    </>
  );
}

function InterventionActions({
  row,
  open,
}: {
  row: Intervention;
  open: (action: Action) => void;
}): ReactElement {
  return (
    <div className={styles.actions}>
      {row.canOrganize && (
        <Button size="sm" variant="ghost" onClick={() => open("LINK")}>
          <Link2 aria-hidden="true" />
          Vincular ocorrência
        </Button>
      )}
      <Button size="sm" onClick={() => open("followUp")}>
        <Pencil aria-hidden="true" />
        Registrar evolução
      </Button>
    </div>
  );
}

function InterventionSources({
  row,
  select,
}: {
  row: Intervention;
  select: SelectFollowUp;
}): ReactElement {
  return (
    <section>
      <h4>Ocorrências motivadoras · {row.occurrences.length}</h4>
      {row.occurrences.map((item) => (
        <button
          key={item.id}
          className={styles.related}
          onClick={() => select({ kind: "occurrence", id: item.id })}
        >
          <small>
            {dateLabel(item.classSession?.date ?? item.occurredOn ?? item.createdAt)} ·{" "}
            {item.classSession?.class.portalClassName ?? "Fora de Aula"}
          </small>
          <strong>{item.title}</strong>
        </button>
      ))}
      {row.occurrences.length === 0 && (
        <p className={styles.muted}>Intervenção registrada sem ocorrência de origem.</p>
      )}
    </section>
  );
}
