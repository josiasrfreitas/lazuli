"use client";

import { useState, type ReactElement } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { Button, Input, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { useWorkshop, type WorkshopView } from "./controller";
import { initialWorkshopState, isOverdue, type Case } from "./model";
import { ActionDialog } from "./workshop-chrome";
import { CaseDetail, Status } from "./record-views";
import styles from "./profile-proposals.module.css";
import {
  Identity,
  StudentContext,
  NewRecord,
  EmptyState,
  Detail,
  CaseLink,
} from "./proposal-shared";

type Mode = "journal" | "desk" | "review";
const PROPOSALS = {
  journal: {
    name: "Prontuário vivo",
    benefit: "Leia o percurso da aluna e abra uma atuação no próprio relato.",
    cost: "Prioriza contexto; uma história longa exige mais rolagem.",
  },
  desk: {
    name: "Mesa de acompanhamento",
    benefit: "Alterne entre registros com a lista e o detalhe sempre à vista.",
    cost: "Prioriza operação; dedica mais espaço do perfil ao acompanhamento.",
  },
  review: {
    name: "Revisão por próximo passo",
    benefit: "Comece pelo combinado mais urgente e revise um caso de cada vez.",
    cost: "Prioriza continuidade; a visão completa fica no histórico.",
  },
};

export function ProfileProposal({
  mode,
  embedded = false,
}: {
  mode: Mode;
  embedded?: boolean;
}): ReactElement {
  const vm = useWorkshop();
  const proposal = PROPOSALS[mode];
  const [empty, setEmpty] = useState(false);
  function reset(blank: boolean): void {
    vm.setState(blank ? { cases: [], occurrences: [] } : initialWorkshopState());
    vm.setSelection(null);
    vm.setAction(null);
    vm.setSearch("");
    vm.setFilter("active");
    vm.setNotice("");
    setEmpty(blank);
  }
  return (
    <div className={`${styles.proposal} ${embedded ? styles.embedded : ""}`} data-proposal={mode}>
      <aside className={styles.proposalNote} aria-label="Proposta em avaliação">
        <div>
          <strong>{proposal.name}</strong>
          <p>
            {proposal.benefit} <span>{proposal.cost}</span>
          </p>
        </div>
        <div className={styles.inlineActions}>
          <Button size="sm" variant="ghost" onClick={() => reset(!empty)}>
            {empty ? "Carregar exemplo" : "Testar sem registros"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Reiniciar simulação"
            onClick={() => reset(false)}
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      </aside>
      {embedded ? (
        <EmbeddedRecords mode={mode} vm={vm} />
      ) : (
        <>
          {mode === "journal" && <JournalProfile vm={vm} />}
          {mode === "desk" && <DeskProfile vm={vm} />}
          {mode === "review" && <ReviewProfile vm={vm} />}
        </>
      )}
      <p role="status" className={styles.notice}>
        {vm.notice}
      </p>
      <ActionDialog vm={vm} />
    </div>
  );
}

function EmbeddedRecords({ mode, vm }: { mode: Mode; vm: WorkshopView }): ReactElement {
  return (
    <>
      <header className={styles.sectionTitle}>
        <div>
          <h2>Acompanhamento pedagógico</h2>
          <p>
            {vm.activeCount} intervenções em aberto · {vm.state.occurrences.length} ocorrências
          </p>
        </div>
        {mode !== "review" && <NewRecord vm={vm} primary />}
      </header>
      {vm.state.cases.length + vm.state.occurrences.length === 0 ? (
        <EmptyState vm={vm} />
      ) : (
        <>
          {mode === "journal" && <JournalRecords vm={vm} />}
          {mode === "desk" && <DeskRecords vm={vm} />}
          {mode === "review" && (
            <>
              <ReviewQueue vm={vm} />
              <ReviewRecords vm={vm} />
            </>
          )}
        </>
      )}
    </>
  );
}

function JournalProfile({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <div className={styles.journalProfile}>
      <Identity />
      <div className={styles.journalGrid}>
        <section className={styles.journalMain} aria-label="Percurso da aluna">
          <div className={styles.sectionTitle}>
            <div>
              <h2>Percurso da aluna</h2>
              <p>Relatos, combinados e resultados no mesmo lugar.</p>
            </div>
            <NewRecord vm={vm} primary />
          </div>
          {vm.state.cases.length + vm.state.occurrences.length === 0 ? (
            <EmptyState vm={vm} />
          ) : (
            <JournalRecords vm={vm} />
          )}
        </section>
        <StudentContext />
      </div>
    </div>
  );
}

function DeskProfile({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <div className={styles.deskProfile}>
      <div className={styles.deskIdentity}>
        <Identity compact />
        <p>
          Beatriz Albuquerque
          <br />
          <span>Seg e qua · 14h–15h30</span>
        </p>
        <p>
          Frequência <strong>93%</strong>
          <span>Média geral 76,75</span>
        </p>
      </div>
      <div className={styles.deskTitle}>
        <div>
          <h2>Acompanhamento</h2>
          <p>
            {vm.activeCount} intervenções em aberto · {vm.state.occurrences.length} relatos
          </p>
        </div>
        <NewRecord vm={vm} />
      </div>
      {vm.state.cases.length + vm.state.occurrences.length === 0 ? (
        <EmptyState vm={vm} />
      ) : (
        <DeskRecords vm={vm} />
      )}
      <details className={styles.archive}>
        <summary>
          Dados acadêmicos e família <ChevronDown aria-hidden="true" />
        </summary>
        <StudentContext />
      </details>
    </div>
  );
}

function ReviewProfile({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <div className={styles.reviewProfile}>
      <aside className={styles.reviewSidebar}>
        <Identity />
        <StudentContext />
      </aside>
      <section className={styles.reviewMain} aria-label="Revisão do acompanhamento">
        <header className={styles.reviewHeading}>
          <div>
            <h2>Próxima conversa</h2>
            <p>Retome o combinado, registre o que mudou e defina como continuar.</p>
          </div>
          <span>13 out 2026</span>
        </header>
        <ReviewQueue vm={vm} />
        <ReviewRecords vm={vm} />
        <details className={styles.mobileContext}>
          <summary>Turma e família</summary>
          <StudentContext />
        </details>
      </section>
    </div>
  );
}

function ReviewCase({ row, vm }: { row: Case; vm: WorkshopView }): ReactElement {
  return (
    <article className={styles.reviewCase}>
      <div className={styles.reviewMeta}>
        <Status row={row} />
        <span data-overdue={isOverdue(row)}>
          <CalendarClock aria-hidden="true" />
          {isOverdue(row) ? "Revisão vencida" : "Revisar até"} · {row.due || "Sem prazo"}
        </span>
      </div>
      <h3>{row.title}</h3>
      <p className={styles.muted}>{row.teacher} · responsável pela atuação</p>
      <section className={styles.commitment}>
        <h4>O combinado</h4>
        <p>{row.nextStep}</p>
      </section>
      <LatestReturn row={row} />
      <div className={styles.reviewAction}>
        <Button onClick={() => vm.open(row.status === "OPEN" ? "start" : "note", row.id)}>
          {row.status === "OPEN" ? "Iniciar atuação" : "Registrar evolução"}
          <ArrowRight aria-hidden="true" />
        </Button>
        <Button variant="ghost" onClick={() => vm.open("conclude", row.id)}>
          Concluir intervenção
        </Button>
      </div>
      <details className={styles.archive}>
        <summary>
          Objetivo, histórico e ocorrências <ChevronDown aria-hidden="true" />
        </summary>
        <CaseDetail
          row={row}
          state={vm.state}
          open={vm.open}
          select={vm.setSelection}
          focus={false}
        />
      </details>
    </article>
  );
}

function JournalRecords({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <>
      <section className={styles.openPlans}>
        <h3>
          Em acompanhamento <span>{vm.activeCount}</span>
        </h3>
        {vm.state.cases
          .filter((row) => row.status !== "CONCLUDED")
          .map((row) => (
            <CaseLink key={row.id} row={row} vm={vm} />
          ))}
      </section>
      {vm.selectedCase && (
        <div className={styles.inlineDetail}>
          <Button size="sm" variant="ghost" onClick={() => vm.setSelection(null)}>
            <ArrowLeft aria-hidden="true" />
            Voltar ao percurso
          </Button>
          <Detail vm={vm} />
        </div>
      )}
      <h3 className={styles.timelineTitle}>Registros das aulas</h3>
      <LessonJournal vm={vm} />
      <details className={styles.archive}>
        <summary>
          Intervenções concluídas <ChevronDown aria-hidden="true" />
        </summary>
        {vm.state.cases
          .filter((row) => row.status === "CONCLUDED")
          .map((row) => (
            <CaseLink key={row.id} row={row} vm={vm} />
          ))}
      </details>
    </>
  );
}

function LessonJournal({ vm }: { vm: WorkshopView }): ReactElement {
  const events = vm.state.occurrences.toSorted((left, right) => {
    return sortable(right.lesson).localeCompare(sortable(left.lesson));
  });
  return (
    <ol className={styles.journal}>
      {events.map((row) => (
        <li key={row.id}>
          <div className={styles.eventDate}>
            <BookOpen aria-hidden="true" />
            <span>{row.lesson.split(" · ")[0]}</span>
          </div>
          <article>
            <p className={styles.muted}>{row.category} · Beatriz Albuquerque</p>
            <h3>{row.title}</h3>
            <p>{row.body}</p>
            <div className={styles.response}>
              <span>Na aula</span>
              <p>{row.response || "Nenhuma resposta inicial registrada."}</p>
            </div>
            <div className={styles.inlineActions}>
              <Button size="sm" variant="secondary" onClick={() => vm.open("create", row.id)}>
                Organizar intervenção
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => vm.setSelection({ type: "occurrence", id: row.id })}
              >
                Ver relato e vínculos
              </Button>
            </div>
            {vm.selectedOccurrence?.id === row.id && <Detail vm={vm} />}
          </article>
        </li>
      ))}
    </ol>
  );
}

export function DeskRecords({ vm }: { vm: WorkshopView }): ReactElement {
  const [scope, setScope] = useState("all");
  const query = vm.search.toLocaleLowerCase("pt-BR");
  const cases = vm.state.cases.filter(
    (row) =>
      row.title.toLocaleLowerCase("pt-BR").includes(query) &&
      (scope === "all" ||
        (scope === "closed" ? row.status === "CONCLUDED" : row.status !== "CONCLUDED")),
  );
  const occurrences =
    scope === "closed"
      ? []
      : vm.state.occurrences.filter((row) => row.title.toLocaleLowerCase("pt-BR").includes(query));
  return (
    <div className={styles.desk} data-selected={vm.selection !== null}>
      <DeskRail vm={vm} cases={cases} occurrences={occurrences} scope={scope} setScope={setScope} />
      <section className={styles.deskDetail} aria-label="Detalhe do registro">
        <div className={styles.mobileBack}>
          <Button size="sm" variant="ghost" onClick={() => vm.setSelection(null)}>
            <ArrowLeft aria-hidden="true" />
            Todos os registros
          </Button>
        </div>
        <Detail vm={vm} fallback={cases[0]} />
      </section>
    </div>
  );
}

function DeskRail({
  vm,
  cases,
  occurrences,
  scope,
  setScope,
}: {
  vm: WorkshopView;
  cases: Case[];
  occurrences: WorkshopView["occurrences"];
  scope: string;
  setScope: (value: string) => void;
}): ReactElement {
  return (
    <aside className={styles.deskRail} aria-label="Registros da aluna">
      <DeskControls vm={vm} scope={scope} setScope={setScope} />
      <h3>Intervenções</h3>
      {cases.map((row) => (
        <CaseLink key={row.id} row={row} vm={vm} />
      ))}
      {cases.length === 0 && <p className={styles.muted}>Nenhuma intervenção neste filtro.</p>}
      <h3>Relatos das aulas</h3>
      {occurrences.map((row) => (
        <button
          type="button"
          className={styles.occurrenceLink}
          key={row.id}
          aria-pressed={vm.selectedOccurrence?.id === row.id}
          onClick={() => vm.setSelection({ type: "occurrence", id: row.id })}
        >
          <small>{row.lesson}</small>
          <strong>{row.title}</strong>
        </button>
      ))}
    </aside>
  );
}

function ReviewQueue({ vm }: { vm: WorkshopView }): ReactElement {
  const [index, setIndex] = useState(0);
  const queue = vm.state.cases
    .filter((row) => row.status !== "CONCLUDED")
    .toSorted((left, right) => Number(isOverdue(right)) - Number(isOverdue(left)));
  const position = Math.min(index, Math.max(queue.length - 1, 0));
  const current = queue[position];
  return (
    <>
      {current ? (
        <>
          <div className={styles.reviewNavigation}>
            <span>
              {position + 1} de {queue.length} intervenções em aberto
            </span>
            <div className={styles.inlineActions}>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Intervenção anterior"
                disabled={position === 0}
                onClick={() => setIndex(position - 1)}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Próxima intervenção"
                disabled={position === queue.length - 1}
                onClick={() => setIndex(position + 1)}
              >
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
          <ReviewCase row={current} vm={vm} />
        </>
      ) : (
        <section className={styles.reviewClear}>
          <Check aria-hidden="true" />
          <h3>Nenhuma intervenção em aberto</h3>
          <p>Consulte os registros anteriores ou comece um novo acompanhamento.</p>
        </section>
      )}
    </>
  );
}

function ReviewRecords({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <div className={styles.reviewRecords}>
      <div className={styles.sectionTitle}>
        <h3>Registros da aluna</h3>
        <NewRecord vm={vm} primary={vm.activeCount === 0} />
      </div>
      {vm.selectedCase || vm.selectedOccurrence ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => vm.setSelection(null)}>
            <ArrowLeft aria-hidden="true" />
            Fechar registro
          </Button>
          <Detail vm={vm} />
        </>
      ) : (
        <details className={styles.archive}>
          <summary>
            Consultar relatos e intervenções concluídas <ChevronDown aria-hidden="true" />
          </summary>
          {vm.state.occurrences.map((row) => (
            <button
              className={styles.occurrenceLink}
              type="button"
              key={row.id}
              onClick={() => vm.setSelection({ type: "occurrence", id: row.id })}
            >
              <small>{row.lesson}</small>
              <strong>{row.title}</strong>
            </button>
          ))}
          {vm.state.cases
            .filter((row) => row.status === "CONCLUDED")
            .map((row) => (
              <CaseLink key={row.id} row={row} vm={vm} />
            ))}
        </details>
      )}
    </div>
  );
}

function LatestReturn({ row }: { row: Case }): ReactElement {
  const latest = row.history[0];
  return (
    <section className={styles.lastReturn}>
      <h4>Último retorno</h4>
      {latest ? (
        <>
          <p>{latest.body}</p>
          <small>{latest.date}</small>
        </>
      ) : (
        <p>A atuação ainda não começou. Registre a primeira conversa com a aluna.</p>
      )}
    </section>
  );
}

function DeskControls({
  vm,
  scope,
  setScope,
}: {
  vm: WorkshopView;
  scope: string;
  setScope: (value: string) => void;
}): ReactElement {
  return (
    <>
      {" "}
      <Input
        size="sm"
        aria-label="Buscar no acompanhamento"
        placeholder="Buscar registro"
        value={vm.search}
        onChange={(event) => vm.setSearch(event.target.value)}
      />
      <SegmentedControl
        aria-label="Situação dos registros"
        value={scope}
        onValueChange={(value) => {
          if (value) setScope(value);
        }}
      >
        <SegmentedControlItem value="all">Tudo</SegmentedControlItem>
        <SegmentedControlItem value="active">Em aberto</SegmentedControlItem>
        <SegmentedControlItem value="closed">Concluídas</SegmentedControlItem>
      </SegmentedControl>
    </>
  );
}

function sortable(value: string): string {
  return value.split(" · ")[0]!.split("/").toReversed().join("");
}
