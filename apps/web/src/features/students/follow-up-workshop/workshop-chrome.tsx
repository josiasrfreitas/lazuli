"use client";
import { type ReactElement } from "react";
import { BookOpen, Check, Plus, RotateCcw } from "lucide-react";
import { Badge, Button, Input, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { WorkshopActionDialog } from "./action-form";
import { ACTION_LABELS, applyWorkshopAction, initialWorkshopState } from "./model";

import { DIRECTIONS, type WorkshopView } from "./controller";
import styles from "./workshop.module.css";

export function WorkshopBar({ vm }: { vm: WorkshopView }): ReactElement {
  const { direction, setDirection, state, setSelection } = vm;
  return (
    <header className={styles.workshopBar}>
      <div>
        <strong>Workshop de acompanhamento</strong>
        <p>Dados fictícios · alterações só nesta sessão · propostas para comparar</p>
      </div>
      <div className={styles.switcher} aria-label="Alternativas do workshop">
        {DIRECTIONS.map((item) => (
          <Button
            key={item.id}
            variant={direction === item.id ? "primary" : "secondary"}
            size="sm"
            aria-pressed={direction === item.id}
            onClick={() => {
              setDirection(item.id);
              setSelection({ type: "case", id: state.cases[0]?.id ?? "" });
            }}
          >
            {item.title}
          </Button>
        ))}
      </div>
    </header>
  );
}
export function DirectionNote({ vm }: { vm: WorkshopView }): ReactElement {
  const { direction, setNotice, chosen, setChosen, option } = vm;
  return (
    <div className={styles.directionNote}>
      <p>
        {option.description} <span>{option.tradeoff}</span>
      </p>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setChosen(direction);
          setNotice(
            `Preferência marcada: ${option.title}. Conte sua escolha no chat para definirmos a versão final.`,
          );
        }}
      >
        <Check aria-hidden="true" />
        {chosen === direction ? "Preferência marcada" : "Prefiro esta visão"}
      </Button>
    </div>
  );
}
export function ProfileHeading(): ReactElement {
  return (
    <div className={styles.profileHeading}>
      <div>
        <p className={styles.breadcrumb}>
          Alunos <span>/</span> Marina Oliveira
        </p>
        <h1>
          Marina Oliveira <Badge variant="success">Ativa</Badge>
        </h1>
      </div>
      <span className={styles.profileSection}>
        <BookOpen aria-hidden="true" /> Pedagógico
      </span>
    </div>
  );
}
export function ProfileContext(): ReactElement {
  return (
    <section className={styles.context} aria-label="Contexto acadêmico da aluna">
      <div>
        <h2>
          Connect 1 <span>Teens Connect</span>
        </h2>
        <p>Beatriz Albuquerque · Seg e qua, 14h–15h30</p>
      </div>
      <div>
        <span>Frequência</span>
        <strong>93%</strong>
        <small>26 de 28 aulas</small>
      </div>
      <div>
        <span>Média geral</span>
        <strong>76,75</strong>
        <small>Estágio atual</small>
      </div>
      <div>
        <span>Responsável</span>
        <strong className={styles.contactName}>Carolina Oliveira</strong>
        <small>Contato disponível no cadastro</small>
      </div>
    </section>
  );
}
export function WorkspaceHeading({ vm }: { vm: WorkshopView }): ReactElement {
  const { state, activeCount, open } = vm;
  return (
    <header className={styles.sectionHeading}>
      <div>
        <h2>Acompanhamento</h2>
        <p>
          {activeCount ? `${activeCount} intervenções em aberto` : "Nenhuma intervenção em aberto"}{" "}
          · {state.occurrences.length} ocorrências registradas
        </p>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={() => open("create")}>
          <Plus aria-hidden="true" />
          Nova intervenção
        </Button>
        <Button variant="secondary" size="sm" onClick={() => open("occurrence")}>
          Registrar ocorrência
        </Button>
      </div>
    </header>
  );
}
export function WorkspaceFilters({ vm }: { vm: WorkshopView }): ReactElement {
  const { setSelection, filter, setFilter, search, setSearch } = vm;
  return (
    <div className={styles.filters}>
      <SegmentedControl
        aria-label="Filtrar intervenções"
        value={filter}
        onValueChange={(value) => {
          setFilter(value ?? "active");
          setSelection(null);
        }}
      >
        <SegmentedControlItem value="active">Em aberto</SegmentedControlItem>
        <SegmentedControlItem value="closed">Concluídas</SegmentedControlItem>
        <SegmentedControlItem value="all">Tudo</SegmentedControlItem>
      </SegmentedControl>
      <div className={styles.search}>
        <Input
          aria-label="Buscar registro"
          name="search"
          autoComplete="off"
          size="sm"
          placeholder="Buscar no histórico da aluna"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
    </div>
  );
}
export function WorkshopFooter({ vm }: { vm: WorkshopView }): ReactElement {
  const { setState, setSelection, setFilter, setSearch, setNotice } = vm;
  return (
    <footer className={styles.workshopFooter}>
      <p>
        <strong>Entrada proposta em Alunos:</strong> filtro “Com acompanhamento em aberto” e
        indicação de revisão vencida na listagem. A gestão de cada caso acontece no perfil.
      </p>
      <div className={styles.actions}>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setState({ cases: [], occurrences: [] });
            setSelection(null);
            setNotice("Cenário sem registros carregado.");
          }}
        >
          Ver aluno sem registros
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setState(initialWorkshopState());
            setSelection({ type: "case", id: "writing" });
            setFilter("active");
            setSearch("");
            setNotice("Cenário inicial restaurado.");
          }}
        >
          <RotateCcw aria-hidden="true" />
          Reiniciar cenário
        </Button>
      </div>
    </footer>
  );
}
export function ActionDialog({ vm }: { vm: WorkshopView }): ReactElement | null {
  const { action, state, setAction, setState, setSelection, setFilter, setNotice } = vm;
  if (!action) return null;
  return (
    <WorkshopActionDialog
      kind={action.kind}
      row={state.cases.find((row) => row.id === action.id)}
      sourceId={action.kind === "create" ? action.id : ""}
      occurrences={state.occurrences}
      onClose={() => setAction(null)}
      onSave={(draft) => {
        const id = crypto.randomUUID();
        setState((current) => applyWorkshopAction(current, { ...action, draft, newId: id }));
        setSelection({
          type: ["occurrence", "complement"].includes(action.kind) ? "occurrence" : "case",
          id: ["occurrence", "create"].includes(action.kind) ? id : action.id,
        });
        if (action.kind === "conclude") setFilter("closed");
        if (action.kind === "create" || action.kind === "reopen") setFilter("active");
        setNotice(`${ACTION_LABELS[action.kind]}: salvo nesta simulação.`);
        setAction(null);
      }}
    />
  );
}
