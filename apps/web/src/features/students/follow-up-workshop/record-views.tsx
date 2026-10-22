import type { ReactElement } from "react";
import { ArrowRight, CalendarClock, ChevronDown, UserRound } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import {
  STATUS_LABELS,
  isOverdue,
  type ActionKind,
  type Case,
  type Entry,
  type Occurrence,
  type WorkshopState,
} from "./model";
import styles from "./workshop.module.css";
type Selection = { type: "case" | "occurrence"; id: string };
type OpenAction = (kind: ActionKind, id?: string) => void;
export function EmptyResults(): ReactElement {
  return (
    <p className={styles.empty}>
      Nenhuma intervenção nesta visão. Altere o filtro ou abra uma nova.
    </p>
  );
}
export function Status({ row }: { row: Case }): ReactElement {
  let variant: "success" | "neutral" | "info" = "info";
  if (row.status === "CONCLUDED") variant = "success";
  else if (row.status === "OPEN") variant = "neutral";
  return <Badge variant={variant}>{STATUS_LABELS[row.status]}</Badge>;
}
export function CaseChoice({
  row,
  selected,
  onSelect,
}: {
  row: Case;
  selected: boolean;
  onSelect: () => void;
}): ReactElement {
  return (
    <button type="button" className={styles.caseChoice} aria-pressed={selected} onClick={onSelect}>
      <span className={styles.choiceMeta}>
        <Status row={row} />
        {isOverdue(row) && <span className={styles.overdue}>Revisão vencida</span>}
      </span>
      <strong>{row.title}</strong>
      <span>
        {row.teacher}
        {row.due && row.status !== "CONCLUDED" ? ` · ${row.due}` : ""}
      </span>
      <ArrowRight aria-hidden="true" className={styles.choiceArrow} />
    </button>
  );
}
export function OccurrenceChoice({
  row,
  onSelect,
}: {
  row: Occurrence;
  onSelect: () => void;
}): ReactElement {
  return (
    <button type="button" className={styles.occurrenceChoice} onClick={onSelect}>
      <span>
        {row.lesson} · {row.category}
      </span>
      <strong>{row.title}</strong>
      <ArrowRight aria-hidden="true" />
    </button>
  );
}
export function History({ rows }: { rows: Entry[] }): ReactElement {
  return (
    <section className={styles.history}>
      <h3>Histórico preservado</h3>
      {rows.length > 0 ? (
        <ol>
          {rows.map((entry, index) => (
            <li key={`${entry.title}-${index}`}>
              <span>{entry.date}</span>
              <h4>{entry.title}</h4>
              <p>{entry.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p>A intervenção foi aberta. O primeiro retorno ficará registrado aqui.</p>
      )}
    </section>
  );
}
export function CaseDetail({
  row,
  state,
  open,
  select,
  focus,
}: {
  row: Case;
  state: WorkshopState;
  open: OpenAction;
  select: (value: Selection) => void;
  focus: boolean;
}): ReactElement {
  const closed = row.status === "CONCLUDED";
  return (
    <article className={styles.caseDetail}>
      <header className={styles.caseHeading}>
        <Status row={row} />
        <h3>{row.title}</h3>
        <p>
          <UserRound aria-hidden="true" />
          {row.teacher}
        </p>
      </header>
      {focus && (
        <ol className={styles.stageTrack} aria-label="Etapas da intervenção">
          <li data-current={row.status === "OPEN"}>Combinar atuação</li>
          <li data-current={row.status === "IN_PROGRESS"}>Acompanhar evolução</li>
          <li data-current={closed}>Registrar resultado</li>
        </ol>
      )}
      <CasePlan row={row} />
      <CaseActions row={row} open={open} />
      <History rows={row.history} />
      <LinkedOccurrences row={row} state={state} select={select} />
    </article>
  );
}

function LinkedOccurrences({
  row,
  state,
  select,
}: {
  row: Case;
  state: WorkshopState;
  select: (value: Selection) => void;
}): ReactElement {
  return (
    <section className={styles.linked}>
      <h4>Ocorrências motivadoras · {row.occurrenceIds.length}</h4>
      {state.occurrences
        .filter((item) => row.occurrenceIds.includes(item.id))
        .map((item) => (
          <OccurrenceChoice
            key={item.id}
            row={item}
            onSelect={() => select({ type: "occurrence", id: item.id })}
          />
        ))}
      {row.occurrenceIds.length === 0 && (
        <p>Aberta diretamente para a aluna. Relatos podem ser vinculados durante a atuação.</p>
      )}
    </section>
  );
}
export function OccurrenceDetail({
  row,
  state,
  open,
  select,
}: {
  row: Occurrence;
  state: WorkshopState;
  open: OpenAction;
  select: (value: Selection) => void;
}): ReactElement {
  const related = state.cases.filter((item) => item.occurrenceIds.includes(row.id));
  return (
    <article className={styles.caseDetail}>
      <header className={styles.caseHeading}>
        <Badge variant="neutral">Ocorrência · {row.category}</Badge>
        <h3>{row.title}</h3>
        <p>{row.lesson} · Beatriz Albuquerque</p>
      </header>
      <OccurrenceNarrative row={row} />
      <div className={styles.actions}>
        <Button size="sm" onClick={() => open("create", row.id)}>
          Organizar intervenção
        </Button>
        <Button size="sm" variant="secondary" onClick={() => open("complement", row.id)}>
          Complementar relato
        </Button>
      </div>
      {related.length > 0 && (
        <section>
          <h4>Intervenções vinculadas</h4>
          {related.map((item) => (
            <CaseChoice
              key={item.id}
              row={item}
              selected={false}
              onSelect={() => select({ type: "case", id: item.id })}
            />
          ))}
        </section>
      )}
      <History rows={row.notes} />
    </article>
  );
}

function CasePlan({ row }: { row: Case }): ReactElement {
  const closed = row.status === "CONCLUDED";
  return (
    <div className={styles.casePlan}>
      <section>
        <h4>Objetivo</h4>
        <p>{row.objective}</p>
      </section>
      <section className={styles.nextStep}>
        <h4>{closed ? "Resultado observado" : "Próximo passo combinado"}</h4>
        <p>
          {closed
            ? row.history.find((entry) =>
                ["Concluir intervenção", "Intervenção concluída"].includes(entry.title),
              )?.body
            : row.nextStep}
        </p>
        {!closed && (
          <span>
            <CalendarClock aria-hidden="true" />
            {row.due ? `Revisar até ${row.due}` : "Sem prazo definido"}
          </span>
        )}
      </section>
    </div>
  );
}
function CaseActions({ row, open }: { row: Case; open: OpenAction }): ReactElement {
  const closed = row.status === "CONCLUDED";
  let action: ActionKind = "note";
  let actionLabel = "Registrar evolução";
  if (closed) {
    action = "reopen";
    actionLabel = "Reabrir intervenção";
  } else if (row.status === "OPEN") {
    action = "start";
    actionLabel = "Iniciar atuação";
  }
  return (
    <div className={styles.actions}>
      <Button size="sm" onClick={() => open(action, row.id)}>
        {actionLabel}
      </Button>
      {!closed && (
        <Button variant="secondary" size="sm" onClick={() => open("conclude", row.id)}>
          Concluir intervenção
        </Button>
      )}
      {!closed && (
        <details className={styles.moreActions}>
          <summary>
            Mais ações <ChevronDown aria-hidden="true" />
          </summary>
          <div>
            <Button variant="ghost" size="sm" onClick={() => open("assign", row.id)}>
              Alterar responsável
            </Button>
            <Button variant="ghost" size="sm" onClick={() => open("link", row.id)}>
              Vincular ocorrências
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}
function OccurrenceNarrative({ row }: { row: Occurrence }): ReactElement {
  return (
    <>
      <section>
        <h4>Relato original</h4>
        <p>{row.body}</p>
      </section>
      {row.response && (
        <section>
          <h4>Resposta inicial</h4>
          <p>{row.response}</p>
        </section>
      )}
    </>
  );
}
