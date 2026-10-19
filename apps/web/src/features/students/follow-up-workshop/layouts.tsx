"use client";
import { type ReactElement } from "react";
import { ArrowLeft, BookOpen, CalendarClock, ChevronDown, MessageSquareText } from "lucide-react";
import { Button } from "@lazuli/ui";

import {
  CaseChoice,
  CaseDetail,
  EmptyResults,
  OccurrenceChoice,
  OccurrenceDetail,
} from "./record-views";
import { type WorkshopView } from "./controller";
import { isOverdue } from "./model";
import styles from "./workshop.module.css";

export function TimelineView({ vm }: { vm: WorkshopView }): ReactElement {
  const { setSelection, selectedCase, selectedOccurrence, cases, occurrences } = vm;
  const detail = <SelectedRecord vm={vm} />;
  return (
    <div className={styles.timelineLayout}>
      <div className={styles.stream}>
        <h3>Intervenções e seus desdobramentos</h3>
        {cases.map((row) => (
          <article className={styles.timelineItem} key={row.id}>
            <div className={styles.timelineMarker}>
              <MessageSquareText aria-hidden="true" />
            </div>
            <div className={styles.timelineBody}>
              <CaseChoice
                row={row}
                selected={selectedCase?.id === row.id}
                onSelect={() =>
                  setSelection(selectedCase?.id === row.id ? null : { type: "case", id: row.id })
                }
              />
              {selectedCase?.id === row.id && detail}
            </div>
          </article>
        ))}
        {cases.length === 0 && <EmptyResults />}
        <h3>Relatos das aulas</h3>
        {occurrences.map((row) => (
          <article className={styles.timelineItem} key={row.id}>
            <div className={styles.timelineMarker}>
              <BookOpen aria-hidden="true" />
            </div>
            <div className={styles.timelineBody}>
              <OccurrenceChoice
                row={row}
                onSelect={() => setSelection({ type: "occurrence", id: row.id })}
              />
              {selectedOccurrence?.id === row.id && detail}
            </div>
          </article>
        ))}
      </div>
      <TimelineContext />
    </div>
  );
}
export function DossierView({ vm }: { vm: WorkshopView }): ReactElement {
  const { selection, setSelection, selectedCase, cases, occurrences } = vm;
  const detail = <SelectedRecord vm={vm} />;
  return (
    <div className={styles.dossier} data-detail={selection !== null}>
      <aside className={styles.recordRail}>
        <h3>Intervenções</h3>
        {cases.map((row) => (
          <CaseChoice
            key={row.id}
            row={row}
            selected={selectedCase?.id === row.id}
            onSelect={() => setSelection({ type: "case", id: row.id })}
          />
        ))}
        {cases.length === 0 && <EmptyResults />}
        <h3>Ocorrências</h3>
        {occurrences.map((row) => (
          <OccurrenceChoice
            key={row.id}
            row={row}
            onSelect={() => setSelection({ type: "occurrence", id: row.id })}
          />
        ))}
      </aside>
      <div className={styles.detailPane}>
        <div className={styles.mobileBack}>
          <Button variant="ghost" size="sm" onClick={() => setSelection(null)}>
            <ArrowLeft aria-hidden="true" />
            Voltar aos registros
          </Button>
        </div>
        {detail}
      </div>
    </div>
  );
}
export function FocusView({ vm }: { vm: WorkshopView }): ReactElement {
  const { setSelection, filter, selectedCase, cases, occurrences } = vm;
  const detail = <SelectedRecord vm={vm} />;
  return (
    <div className={styles.focusLayout}>
      <div className={styles.focusQueue}>
        <h3>{filter === "closed" ? "Revisitar resultados" : "O que precisa de atenção"}</h3>
        <p>Escolha uma intervenção para continuar.</p>
        <div className={styles.focusChoices}>
          {cases
            .toSorted((left, right) => Number(isOverdue(right)) - Number(isOverdue(left)))
            .map((row) => (
              <CaseChoice
                key={row.id}
                row={row}
                selected={selectedCase?.id === row.id}
                onSelect={() => setSelection({ type: "case", id: row.id })}
              />
            ))}
        </div>
        {cases.length === 0 && <EmptyResults />}
      </div>
      <div className={styles.focusDetail}>{detail}</div>
      <details className={styles.occurrenceShelf}>
        <summary>
          Relatos das aulas · {occurrences.length}
          <ChevronDown aria-hidden="true" />
        </summary>
        {occurrences.map((row) => (
          <OccurrenceChoice
            key={row.id}
            row={row}
            onSelect={() => setSelection({ type: "occurrence", id: row.id })}
          />
        ))}
      </details>
    </div>
  );
}
export function SelectedRecord({ vm }: { vm: WorkshopView }): ReactElement {
  const { selectedCase, selectedOccurrence, state, open, setSelection, direction } = vm;
  return selectedCase ? (
    <CaseDetail
      row={selectedCase}
      state={state}
      open={open}
      select={setSelection}
      focus={direction === "focus"}
    />
  ) : selectedOccurrence ? (
    <OccurrenceDetail row={selectedOccurrence} state={state} open={open} select={setSelection} />
  ) : (
    <div className={styles.empty}>
      <MessageSquareText aria-hidden="true" />
      <h3>Escolha um registro</h3>
      <p>O relato e as ações aparecem aqui, dentro do perfil.</p>
    </div>
  );
}

function TimelineContext(): ReactElement {
  return (
    <aside className={styles.contextAside}>
      <h3>Continuidade do cuidado</h3>
      <p>
        O relato preserva o que aconteceu. A intervenção reúne as ações combinadas para acompanhar a
        aluna.
      </p>
      <h4>Na próxima revisão</h4>
      <p>Confira o resultado do último combinado antes de definir um novo passo.</p>
      <div className={styles.reviewDate}>
        <CalendarClock aria-hidden="true" />
        <span>
          Hoje no cenário
          <br />
          <strong>13 de outubro de 2026</strong>
        </span>
      </div>
    </aside>
  );
}
