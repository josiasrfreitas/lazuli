import type { JSX as ReactJSX } from "react";
import { ArrowLeft, CalendarRange, Copy, Plus, X, MoreHorizontal, Search } from "lucide-react";
import { Button, Input, InlineSkeleton, Popover, PopoverTrigger, PopoverContent } from "@lazuli/ui";
import { SelectControl } from "~/features/classes/form-controls";
import { dateOnly } from "~/features/semester-organization/shared";
import { SemesterForm } from "~/features/semester-organization/plan-form";
import { OrganizationAgenda } from "./agenda";
import { OrganizationReview } from "./review";
import { OrganizationCalendar } from "./calendar";
import { OrganizationDialogs } from "./dialogs";
import type { OrganizationPageModel } from "./page-model";
import { OrganizationLoading } from "./page-loading";
import styles from "./organization.module.css";

export function OrganizationPageView({
  model,
}: {
  model: OrganizationPageModel;
}): ReactJSX.Element {
  return (
    <section className={styles.page} aria-label="Organização de turmas">
      <PageHeader model={model} />
      <PageToolbar model={model} />
      <PageError model={model} />
      <PageBody model={model} />
      <PageFeedback model={model} />
      <PageDialogs model={model} />
    </section>
  );
}

function PageHeader({ model }: { model: OrganizationPageModel }): ReactJSX.Element {
  return (
    <header className={styles.header}>
      <h1>Organização de turmas</h1>
      <HeaderPeriod model={model} />
      <HeaderAgendaSearch model={model} />
      <HeaderActions model={model} />
    </header>
  );
}

function HeaderPeriod({ model }: { model: OrganizationPageModel }): ReactJSX.Element {
  const { board, periods, semesterId, today, ended, selectPeriod } = model;
  let periodLabel = "Em andamento";
  if (board && dateOnly(board.semester.startDate) > today) periodLabel = "Próximo período";
  else if (ended) periodLabel = "Período encerrado";
  return (
    <>
      <div className={styles.period}>
        {periods.isPending ? (
          <InlineSkeleton className="h-8 w-full" />
        ) : (
          <SelectControl
            name="organization-semester"
            label="Período"
            hideLabel
            value={semesterId}
            onChange={selectPeriod}
            choices={(periods.data ?? []).map((period) => ({
              value: period.id,
              label: period.name,
            }))}
          />
        )}
      </div>
      <span className={styles.description}>{board && periodLabel}</span>
    </>
  );
}

function HeaderAgendaSearch({ model }: { model: OrganizationPageModel }): ReactJSX.Element | null {
  const { tab, classSearch, setClassSearch } = model;
  if (tab !== "agenda") return null;
  return (
    <>
      <span className={styles.headerHint}>
        Selecione uma turma para cuidar dos alunos e da continuidade.
      </span>
      <div className={styles.headerSearch}>
        <Input
          size="sm"
          leadingIcon={<Search aria-hidden="true" />}
          aria-label="Buscar turma ou professor"
          placeholder="Turma ou professor…"
          value={classSearch}
          onChange={(event) => setClassSearch(event.target.value)}
        />
      </div>
    </>
  );
}

function HeaderActions({ model }: { model: OrganizationPageModel }): ReactJSX.Element {
  const { board, ended, query, prepare, setAction } = model;
  return (
    <div className={`${styles.actions} ${styles.push}`}>
      <span className={styles.busy} role="status">
        {(query.isFetching && board) || prepare.isPending ? "Atualizando…" : ""}
      </span>
      <Button
        size="sm"
        variant="secondary"
        disabled={!board || ended}
        onClick={() => setAction({ kind: "plan" })}
      >
        <Plus size={14} /> Nova turma
      </Button>
      <PageHeaderMenu model={model} />
    </div>
  );
}

function PageHeaderMenu({ model }: { model: OrganizationPageModel }): ReactJSX.Element {
  const { setupOpen, setSetupOpen } = model;
  return (
    <Popover open={setupOpen} onOpenChange={setSetupOpen}>
      <PopoverTrigger
        render={<Button size="sm" variant="ghost" aria-label="Opções da organização" />}
      >
        <MoreHorizontal size={16} />
      </PopoverTrigger>
      <PopoverContent align="end" size="md">
        <div className="grid gap-2">
          <PageMenuNavigation model={model} />
          <PageMenuActions model={model} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PageMenuNavigation({ model }: { model: OrganizationPageModel }): ReactJSX.Element {
  const { setSetupOpen, setTab, showClosed, setShowClosed } = model;
  const chooseTab = (value: string): void => {
    setSetupOpen(false);
    setTab(value);
  };
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => chooseTab("calendar")}>
        Calendário letivo
      </Button>
      <Button size="sm" variant="ghost" onClick={() => chooseTab("review")}>
        Revisar alocações
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setSetupOpen(false);
          setShowClosed(!showClosed);
          setTab("agenda");
        }}
      >
        {showClosed ? "Ocultar encerradas" : "Mostrar turmas encerradas"}
      </Button>
    </>
  );
}

function PageMenuActions({ model }: { model: OrganizationPageModel }): ReactJSX.Element {
  const { setSetupOpen, board, ended, prepare, semesterId, setAction } = model;
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={!board || ended || prepare.isPending}
        onClick={() => {
          setSetupOpen(false);
          prepare.mutate({ semesterId });
        }}
      >
        <Copy size={14} /> Atualizar turmas e alunos
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setSetupOpen(false);
          setAction({ kind: "newSemester" });
        }}
      >
        <CalendarRange size={14} /> Preparar próximo período
      </Button>
    </>
  );
}

function PageToolbar({ model }: { model: OrganizationPageModel }): ReactJSX.Element | null {
  const { tab, setTab, search, setSearch } = model;
  if (tab === "agenda") return null;
  return (
    <div className={styles.toolbar}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setTab("agenda");
          setSearch("");
        }}
      >
        <ArrowLeft size={14} /> Turmas e pendências
      </Button>
      <span className={styles.small}>
        {tab === "review" ? "Revisar alocações" : "Calendário letivo"}
      </span>
      {tab === "review" && (
        <div className={`${styles.search} ${styles.push}`}>
          <Input
            size="sm"
            aria-label="Buscar aluno na revisão"
            placeholder="Buscar aluno…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function PageError({ model }: { model: OrganizationPageModel }): ReactJSX.Element | null {
  const { query, periods, prepare, semesterId } = model;
  if (!query.error && !periods.error && !prepare.error) return null;
  return (
    <div role="alert" className={styles.error}>
      <span>{query.error?.message ?? periods.error?.message ?? prepare.error?.message}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          void periods.refetch();
          if (semesterId) void query.refetch();
          prepare.reset();
        }}
      >
        Tentar novamente
      </Button>
    </div>
  );
}

function PageBody({ model }: { model: OrganizationPageModel }): ReactJSX.Element | null {
  const { periods, semesterId, query, board, setAction } = model;
  if (periods.isPending || (semesterId && query.isPending)) return <OrganizationLoading />;
  if (!semesterId)
    return (
      <div className={styles.empty}>
        <h2>Comece pelo período letivo</h2>
        <p>
          Defina as datas reais do semestre. A estrutura de turmas poderá ser reaproveitada e
          ajustada ao longo do tempo.
        </p>
        <Button size="sm" onClick={() => setAction({ kind: "newSemester" })}>
          Criar semestre
        </Button>
      </div>
    );
  if (!board) return null;
  return (
    <>
      <EmptyBoard model={model} />
      <BoardTab model={model} />
    </>
  );
}

function EmptyBoard({ model }: { model: OrganizationPageModel }): ReactJSX.Element | null {
  const { board, tab, prepare, ended, semesterId, setAction } = model;
  if (!board || board.plans.length > 0 || tab !== "agenda") return null;
  return (
    <div className={styles.empty}>
      <h2>Use as turmas existentes como ponto de partida</h2>
      <p>
        Horários, professores e alunos continuam juntos. Depois, revise apenas as exceções e acomode
        quem está chegando.
      </p>
      <div className={styles.actions}>
        <Button
          size="sm"
          disabled={prepare.isPending || ended}
          onClick={() => prepare.mutate({ semesterId })}
        >
          {prepare.isPending
            ? "Preparando turmas e alunos…"
            : "Usar turmas deste semestre como base"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={ended}
          onClick={() => setAction({ kind: "plan" })}
        >
          Criar primeira turma
        </Button>
      </div>
    </div>
  );
}

function BoardTab({ model }: { model: OrganizationPageModel }): ReactJSX.Element | null {
  const {
    board,
    tab,
    semesterId,
    classSearch,
    showClosed,
    setFeedback,
    planId,
    setPlanId,
    setAction,
    search,
  } = model;
  if (!board) return null;
  if (tab === "agenda")
    return (
      <OrganizationAgenda
        key={semesterId}
        board={board}
        search={classSearch}
        showClosed={showClosed}
        onFeedback={setFeedback}
        selected={planId}
        onSelect={setPlanId}
        onAction={setAction}
      />
    );
  if (tab === "review")
    return (
      <OrganizationReview
        key={semesterId}
        board={board}
        query={search}
        onAction={setAction}
        onFeedback={setFeedback}
      />
    );
  return <OrganizationCalendar board={board} onAction={setAction} />;
}

function PageFeedback({ model }: { model: OrganizationPageModel }): ReactJSX.Element | null {
  const { feedback, setFeedback } = model;
  if (!feedback) return null;
  return (
    <div className={styles.feedback} role="status">
      <span>{feedback}</span>
      <div className={styles.push}>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Dispensar mensagem"
          onClick={() => setFeedback("")}
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}

function PageDialogs({ model }: { model: OrganizationPageModel }): ReactJSX.Element | null {
  const { action, board, setAction, selectPeriod, setPlanId, setFeedback } = model;
  if (!action) return null;
  if (!board)
    return action.kind === "newSemester" ? (
      <SemesterForm onClose={() => setAction(null)} onSaved={selectPeriod} />
    ) : null;
  return (
    <OrganizationDialogs
      key={`${action.kind}:${"studentId" in action ? action.studentId : ""}`}
      action={action}
      board={board}
      onAction={setAction}
      onClose={() => setAction(null)}
      onSemester={selectPeriod}
      onPlan={setPlanId}
      onFeedback={setFeedback}
    />
  );
}
