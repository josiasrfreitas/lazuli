"use client";
import { useState, type ReactElement } from "react";
import { ArrowRight, ChevronDown, Plus } from "lucide-react";
import {
  Button,
  SegmentedControl,
  SegmentedControlItem,
  Sheet,
  SheetBackdrop,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetPortal,
  SheetTitle,
} from "@lazuli/ui";
import { initialWorkshopState, isOverdue, type Case, type Occurrence } from "./model";
import type { WorkshopView } from "./controller";
import { CaseDetail, OccurrenceDetail } from "./record-views";
import styles from "./simple-views.module.css";

export function ScenarioPicker({ vm }: { vm: WorkshopView }): ReactElement {
  const full = vm.state.cases.length + vm.state.occurrences.length > 0;
  return (
    <header className={styles.workshopBar}>
      <div>
        <strong>Workshop · acompanhamento no aluno</strong>
        <p>Dados fictícios. Compare as opções pelo seletor do Impeccable.</p>
      </div>
      <SegmentedControl
        aria-label="Estado do exemplo"
        value={full ? "full" : "empty"}
        onValueChange={(value) => {
          if (!value) return;
          vm.setState(value === "full" ? initialWorkshopState() : { cases: [], occurrences: [] });
          vm.setSelection(null);
          vm.setAction(null);
          vm.setFilter("active");
          vm.setSearch("");
          vm.setNotice("");
        }}
      >
        <SegmentedControlItem value="full">Com registros</SegmentedControlItem>
        <SegmentedControlItem value="empty">Sem registros</SegmentedControlItem>
      </SegmentedControl>
    </header>
  );
}
export function QuietHeader({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <header className={styles.header}>
      <div>
        <h2>Acompanhamento</h2>
        <p>
          {vm.activeCount > 0
            ? `${vm.activeCount} intervenções em aberto`
            : "Registros e cuidado com a aluna"}
        </p>
      </div>
      <Button size="sm" onClick={() => vm.open("occurrence")}>
        <Plus aria-hidden="true" />
        Registrar ocorrência
      </Button>
    </header>
  );
}
export function EmptyFollowUp({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <div className={styles.empty}>
      <h3>Nenhum acompanhamento registrado</h3>
      <p>
        Quando houver algo a acompanhar, registre o que aconteceu ou abra uma intervenção
        diretamente.
      </p>
      <Button size="sm" onClick={() => vm.open("occurrence")}>
        <Plus aria-hidden="true" />
        Registrar ocorrência
      </Button>
      <Button variant="link" size="sm" onClick={() => vm.open("create")}>
        Abrir intervenção
      </Button>
    </div>
  );
}
function InterventionRow({ row, vm }: { row: Case; vm: WorkshopView }): ReactElement {
  const closed = row.status === "CONCLUDED";
  return (
    <button
      className={styles.row}
      type="button"
      onClick={() => vm.setSelection({ type: "case", id: row.id })}
    >
      <span>
        <strong>{row.title}</strong>
        <small>{closed ? "Concluída" : row.nextStep}</small>
      </span>
      <span className={styles.rowAside} data-overdue={isOverdue(row)}>
        {closed ? "Ver resultado" : row.due || "Sem prazo"}
        {isOverdue(row) && <small>Revisão vencida</small>}
      </span>
      <ArrowRight aria-hidden="true" />
    </button>
  );
}
function OccurrenceRow({ row, vm }: { row: Occurrence; vm: WorkshopView }): ReactElement {
  return (
    <button
      className={styles.row}
      type="button"
      onClick={() => vm.setSelection({ type: "occurrence", id: row.id })}
    >
      <span>
        <strong>{row.title}</strong>
        <small>Ocorrência · {row.category}</small>
      </span>
      <span className={styles.rowAside}>{row.lesson.split(" · ")[0]}</span>
      <ArrowRight aria-hidden="true" />
    </button>
  );
}
function RecordHistory({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <div>
      {vm.state.occurrences.toReversed().map((row) => (
        <OccurrenceRow key={row.id} row={row} vm={vm} />
      ))}
      {vm.state.cases
        .filter((row) => row.status === "CONCLUDED")
        .map((row) => (
          <InterventionRow key={row.id} row={row} vm={vm} />
        ))}
    </div>
  );
}
function NewIntervention({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <div className={styles.secondaryAction}>
      <Button variant="link" size="sm" onClick={() => vm.open("create")}>
        Abrir intervenção sem ocorrência
      </Button>
    </div>
  );
}
export function QuietSummary({ vm }: { vm: WorkshopView }): ReactElement {
  if (vm.state.cases.length + vm.state.occurrences.length === 0) return <EmptyFollowUp vm={vm} />;
  return (
    <div className={styles.surface}>
      <QuietHeader vm={vm} />
      <div className={styles.rows}>
        {vm.state.cases
          .filter((row) => row.status !== "CONCLUDED")
          .map((row) => (
            <InterventionRow key={row.id} row={row} vm={vm} />
          ))}
      </div>
      <details className={styles.history}>
        <summary>
          Ver histórico e ocorrências <ChevronDown aria-hidden="true" />
        </summary>
        <RecordHistory vm={vm} />
      </details>
      <NewIntervention vm={vm} />
    </div>
  );
}
export function QuietInbox({ vm }: { vm: WorkshopView }): ReactElement {
  const [view, setView] = useState("active");
  if (vm.state.cases.length + vm.state.occurrences.length === 0) return <EmptyFollowUp vm={vm} />;
  return (
    <div className={styles.surface}>
      <QuietHeader vm={vm} />
      <div className={styles.tabs}>
        <SegmentedControl
          aria-label="Registros do aluno"
          value={view}
          onValueChange={(value) => {
            if (value) setView(value);
          }}
        >
          <SegmentedControlItem value="active">Em aberto · {vm.activeCount}</SegmentedControlItem>
          <SegmentedControlItem value="history">Histórico</SegmentedControlItem>
        </SegmentedControl>
      </div>
      {view === "active" ? (
        <div className={styles.rows}>
          {vm.state.cases
            .filter((row) => row.status !== "CONCLUDED")
            .map((row) => (
              <InterventionRow key={row.id} row={row} vm={vm} />
            ))}
          {vm.activeCount === 0 && (
            <p className={styles.clear}>
              Tudo acompanhado. Consulte as atuações concluídas no histórico.
            </p>
          )}
        </div>
      ) : (
        <RecordHistory vm={vm} />
      )}
      <NewIntervention vm={vm} />
    </div>
  );
}
export function QuietJournal({ vm }: { vm: WorkshopView }): ReactElement {
  if (vm.state.cases.length + vm.state.occurrences.length === 0) return <EmptyFollowUp vm={vm} />;
  return (
    <div className={styles.surface}>
      <QuietHeader vm={vm} />
      <div className={styles.journal}>
        <section>
          <h3>Em acompanhamento</h3>
          {vm.state.cases
            .filter((row) => row.status !== "CONCLUDED")
            .map((row) => (
              <InterventionRow key={row.id} row={row} vm={vm} />
            ))}
        </section>
        <section>
          <h3>Registros anteriores</h3>
          <RecordHistory vm={vm} />
        </section>
      </div>
      <NewIntervention vm={vm} />
    </div>
  );
}
export function RecordPanel({ vm }: { vm: WorkshopView }): ReactElement | null {
  if ((!vm.selectedCase && !vm.selectedOccurrence) || vm.action) return null;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) vm.setSelection(null);
      }}
    >
      <SheetPortal>
        <SheetBackdrop />
        <SheetContent size="lg">
          <SheetHeader>
            <SheetTitle>{vm.selectedCase?.title ?? vm.selectedOccurrence?.title}</SheetTitle>
            <SheetDescription>Marina Oliveira · Acompanhamento pedagógico</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className={styles.readingPanel}>
              {vm.selectedCase ? (
                <CaseDetail
                  row={vm.selectedCase}
                  state={vm.state}
                  open={vm.open}
                  select={vm.setSelection}
                  focus={false}
                />
              ) : (
                vm.selectedOccurrence && (
                  <OccurrenceDetail
                    row={vm.selectedOccurrence}
                    state={vm.state}
                    open={vm.open}
                    select={vm.setSelection}
                  />
                )
              )}
            </div>
          </SheetBody>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}
