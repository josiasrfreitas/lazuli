import { useState, type ReactElement } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Copy,
  Plus,
  Settings2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import { SelectControl } from "~/features/classes/form-controls";
import { academicPeriodsUrl } from "./links";
import { dateOnly } from "./shared";
import { OrganizationAgenda, WeekControls } from "./agenda";
import { OrganizationReview } from "./review";
import { OrganizationDialogs } from "./dialogs";
import type { OrganizationPageModel } from "./page-model";
import { OrganizationLoading, FormationProgress } from "./page-loading";
import { trpc } from "~/lib/trpc";
import styles from "./formation.module.css";

type ModelProps = { model: OrganizationPageModel };
type FilterProps = { scope: string; weekSearch: string; clearFilters: () => void };
export function OrganizationPageView({ model }: ModelProps): ReactElement {
  const { board, semesterId, action, setAction } = model;
  const [scope, setScope] = useState("all");
  const [weekSearch, setWeekSearch] = useState("");
  const clearFilters = (): void => {
    setScope("all");
    setWeekSearch("");
  };
  const switching = Boolean(board && board.semester.id !== semesterId);
  return (
    <section className={styles.page} data-page-scroll="internal" aria-label="Formação de turmas">
      <FormationHeader
        model={model}
        scope={scope}
        weekSearch={weekSearch}
        clearFilters={clearFilters}
        setScope={setScope}
        setWeekSearch={setWeekSearch}
        switching={switching}
      />
      <FormationError model={model} />
      {switching && <FormationProgress label="Atualizando o período" />}
      <PeriodContent
        model={model}
        scope={scope}
        weekSearch={weekSearch}
        clearFilters={clearFilters}
        switching={switching}
      />
      {model.feedback && (
        <div className={styles.feedback} role="status">
          {model.feedback}
          <Button
            size="sm"
            variant="ghost"
            aria-label="Dispensar mensagem"
            onClick={() => model.setFeedback("")}
          >
            <X size={14} />
          </Button>
        </div>
      )}
      {action && board && (
        <OrganizationDialogs
          key={action.kind}
          action={action}
          board={board}
          onAction={setAction}
          onClose={() => setAction(null)}
          onPlan={model.setPlanId}
          onFeedback={model.setFeedback}
        />
      )}
    </section>
  );
}
function FormationHeader({
  model,
  scope,
  weekSearch,
  clearFilters,
  setScope,
  setWeekSearch,
  switching,
}: ModelProps &
  FilterProps & {
    setScope: (scope: string) => void;
    setWeekSearch: (query: string) => void;
    switching: boolean;
  }): ReactElement {
  const { board, ended } = model;
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1>Grade semanal</h1>
      </div>
      <PeriodSelect
        model={model}
        onChange={(id) => {
          clearFilters();
          model.selectPeriod(id);
        }}
      />
      {board && model.tab !== "review" && board.plans.length > 0 && (
        <WeekControls
          board={board}
          scope={scope}
          query={weekSearch}
          onScope={setScope}
          onQuery={setWeekSearch}
        />
      )}
      <div className={styles.headerActions} inert={switching}>
        {board && !ended && model.tab !== "review" && (
          <Button size="sm" onClick={() => model.setTab("review")}>
            Revisar vínculos <ChevronRight size={15} />
          </Button>
        )}
        <OptionsMenu model={model} />
      </div>
    </header>
  );
}
function PeriodSelect({
  model,
  onChange,
}: ModelProps & { onChange: (id: string) => void }): ReactElement {
  const { periods, semesterId } = model;
  const selected = semesterId || "proximo";
  const choices = (periods.data ?? []).map((period) => ({ value: period.id, label: period.name }));
  if (periods.data && !periods.data.some((period) => dateOnly(period.startDate) > model.today))
    choices.unshift({ value: "proximo", label: "Próximo período" });
  return periods.isPending ? (
    <Button size="sm" variant="secondary" disabled>
      Período letivo
    </Button>
  ) : (
    <SelectControl
      name="formation-period"
      label="Período letivo"
      hideLabel
      value={selected}
      onChange={onChange}
      choices={choices}
    />
  );
}
function OptionsMenu({ model }: ModelProps): ReactElement {
  const { board, ended, prepare, semesterId, setAction } = model;
  return (
    <Popover open={model.setupOpen} onOpenChange={model.setSetupOpen}>
      <PopoverTrigger render={<Button size="sm" variant="ghost" aria-label="Opções da formação" />}>
        <Settings2 size={16} />
      </PopoverTrigger>
      <PopoverContent align="end" size="menu">
        <div className={styles.menuItems}>
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href={academicPeriodsUrl} />}
          >
            <CalendarDays /> Calendário acadêmico
          </Button>
          {board && !ended && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  model.setSetupOpen(false);
                  setAction({ kind: "plan" });
                }}
              >
                <Plus /> Nova turma
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={prepare.isPending}
                onClick={() => {
                  model.setSetupOpen(false);
                  prepare.mutate({ semesterId });
                }}
              >
                <Copy /> Atualizar turmas de origem
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  model.setSetupOpen(false);
                  setAction({ kind: "riskLimit" });
                }}
              >
                <TriangleAlert /> Limite de alunos para alerta
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
function FormationError({ model }: ModelProps): ReactElement | null {
  const failure = failedOperation(model);
  if (!failure) return null;
  return (
    <div role="alert" className={styles.notice}>
      {failure.message}
      <Button variant="ghost" size="sm" disabled={failure.pending} onClick={failure.retry}>
        Tentar novamente
      </Button>
    </div>
  );
}
function failedOperation({
  periods,
  query,
  prepare,
  semesterId,
}: OrganizationPageModel): { message: string; pending: boolean; retry: () => void } | null {
  if (periods.error)
    return {
      message: periods.error.data
        ? periods.error.message
        : "Não foi possível carregar os períodos letivos.",
      pending: periods.isFetching,
      retry: () => void periods.refetch(),
    };
  if (query.error)
    return {
      message: query.error.data
        ? query.error.message
        : "Não foi possível carregar as turmas deste período.",
      pending: query.isFetching,
      retry: () => void query.refetch(),
    };
  if (prepare.error && prepare.variables?.semesterId === semesterId)
    return {
      message: prepare.error.data
        ? prepare.error.message
        : "Não foi possível atualizar as turmas de origem.",
      pending: prepare.isPending,
      retry: () => prepare.mutate({ semesterId }),
    };
  return null;
}
function PeriodContent({
  model,
  scope,
  weekSearch,
  clearFilters,
  switching,
}: ModelProps & FilterProps & { switching: boolean }): ReactElement | null {
  const { periods, board, semesterId, query, setAction, prepare } = model;
  if (periods.isPending || (semesterId && query.isPending)) return <OrganizationLoading />;
  if (!semesterId && !periods.error) return <CalendarGate />;
  if (!board) return null;
  return (
    <div className={styles.board} inert={switching} aria-busy={switching}>
      {model.tab === "review" ? (
        <>
          <div className={styles.tools}>
            <Button size="sm" variant="ghost" onClick={() => model.setTab("agenda")}>
              <ArrowLeft /> Grade e pendências
            </Button>
            <Input
              size="sm"
              aria-label="Buscar aluno na revisão"
              placeholder="Buscar aluno"
              value={model.search}
              onChange={(event) => model.setSearch(event.target.value)}
            />
          </div>
          <OrganizationReview
            key={semesterId}
            board={board}
            query={model.search}
            onAction={setAction}
            onFeedback={model.setFeedback}
          />
        </>
      ) : (
        <OrganizationAgenda
          scope={scope}
          query={weekSearch}
          clearFilters={clearFilters}
          key={board.semester.id}
          board={board}
          today={model.today}
          selected={model.planId}
          onSelect={model.setPlanId}
          onAction={setAction}
          onFeedback={model.setFeedback}
          prepare={() => prepare.mutate({ semesterId })}
          preparing={prepare.isPending}
        />
      )}
    </div>
  );
}
function CalendarGate(): ReactElement {
  const waiting = trpc.semesterOrganization.undatedIntakes.useQuery();
  return (
    <div className={styles.gate}>
      <CalendarDays size={28} />
      <h2>Quando começa o próximo período?</h2>
      <p>
        Defina as datas no calendário acadêmico para preparar as turmas e oficializar os vínculos.
      </p>
      <Button size="sm" nativeButton={false} render={<Link href={academicPeriodsUrl} />}>
        Definir período no calendário
      </Button>
      {waiting.error && <p role="alert">{waiting.error.message}</p>}
      {waiting.isPending && <FormationProgress label="Buscando alunos que aguardam o período" />}
      {!!waiting.data?.length && (
        <section>
          <h3>Aguardando o período · {waiting.data.length}</h3>
          <ul>
            {waiting.data.map((row) => (
              <li key={row.studentId}>
                <Link href={`/alunos/${row.studentId}`}>{row.student.fullName}</Link> ·{" "}
                {row.stage?.internalCode ?? "Estágio a definir"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
