"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { ArrowLeft, CalendarRange, Copy, Plus, X, MoreHorizontal, Search } from "lucide-react";
import { Button, Input, InlineSkeleton, Popover, PopoverTrigger, PopoverContent } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { SelectControl } from "~/features/classes/form-controls";
import { dateOnly, useOrganizationRefresh } from "~/features/semester-organization/shared";
import { SemesterForm } from "~/features/semester-organization/plan-form";
import { OrganizationAgenda } from "./agenda";
import { OrganizationReview } from "./review";
import { OrganizationCalendar } from "./calendar";
import { OrganizationDialogs } from "./dialogs";
import type { OrganizationAction } from "./model";
import s from "./organization.module.css";

export function OrganizationLoading(): ReactJSX.Element {
  return (
    <div className={s.loading} role="status" aria-label="Carregando organização">
      <div className={s.skeletonGrid}>
        {Array.from({ length: 35 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className={s.skeletonPanel}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <span className="sr-only">Carregando turmas e alunos…</span>
    </div>
  );
}
export function ClassOrganizationPage(): ReactJSX.Element {
  const [selectedPeriod, setSelectedPeriod] = useQueryState(
    "semestre",
    parseAsString.withDefault(""),
  );
  const [tab, setTab] = useQueryState("visao", parseAsString.withDefault("agenda"));
  const [search, setSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [action, setAction] = useState<OrganizationAction | null>(null);
  const [feedback, setFeedback] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const periods = trpc.semesterOrganization.semesters.useQuery();
  const today = toDateOnlySaoPaulo(new Date());
  const current = periods.data?.find(
    (period) => dateOnly(period.startDate) <= today && dateOnly(period.endDate) >= today,
  );
  const semesterId =
    selectedPeriod ||
    current?.id ||
    periods.data?.find((period) => dateOnly(period.endDate) >= today)?.id ||
    periods.data?.[0]?.id ||
    "";
  const query = trpc.semesterOrganization.detail.useQuery(
    { semesterId },
    { enabled: Boolean(semesterId) },
  );
  const board = query.data;
  const refresh = useOrganizationRefresh();
  const prepare = trpc.semesterOrganization.prepare.useMutation({
    onSuccess: async (result) => {
      await refresh();
      setFeedback(
        `Base incorporada: ${result.plans} turmas e ${result.students} alunos. Ajustes anteriores preservados.`,
      );
    },
  });
  function selectPeriod(id: string): void {
    void setSelectedPeriod(id);
    setPlanId(null);
    setAction(null);
    setFeedback("");
    setClassSearch("");
  }
  const ended = board ? dateOnly(board.semester.endDate) < today : false;
  return (
    <section className={s.page} aria-label="Organização de turmas">
      <header className={s.header}>
        <h1>Organização de turmas</h1>
        <div className={s.period}>
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
        <span className={s.description}>
          {board &&
            (dateOnly(board.semester.startDate) > today
              ? "Próximo período"
              : ended
                ? "Período encerrado"
                : "Em andamento")}
        </span>
        {tab === "agenda" && (
          <>
            <span className={s.headerHint}>
              Selecione uma turma para cuidar dos alunos e da continuidade.
            </span>
            <div className={s.headerSearch}>
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
        )}
        <div className={`${s.actions} ${s.push}`}>
          <span className={s.busy} role="status">
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
          <Popover open={setupOpen} onOpenChange={setSetupOpen}>
            <PopoverTrigger
              render={<Button size="sm" variant="ghost" aria-label="Opções da organização" />}
            >
              <MoreHorizontal size={16} />
            </PopoverTrigger>
            <PopoverContent align="end" size="md">
              <div className="grid gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSetupOpen(false);
                    void setTab("calendar");
                  }}
                >
                  Calendário letivo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSetupOpen(false);
                    void setTab("review");
                  }}
                >
                  Revisar alocações
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSetupOpen(false);
                    setShowClosed(!showClosed);
                    void setTab("agenda");
                  }}
                >
                  {showClosed ? "Ocultar encerradas" : "Mostrar turmas encerradas"}
                </Button>

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
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>
      {tab !== "agenda" && (
        <div className={s.toolbar}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void setTab("agenda");
              setSearch("");
            }}
          >
            <ArrowLeft size={14} /> Turmas e pendências
          </Button>
          <span className={s.small}>
            {tab === "review" ? "Revisar alocações" : "Calendário letivo"}
          </span>
          {tab === "review" && (
            <Input
              size="sm"
              className={`${s.search} ${s.push}`}
              aria-label="Buscar aluno na revisão"
              placeholder="Buscar aluno…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
        </div>
      )}
      {(query.error || periods.error || prepare.error) && (
        <div role="alert" className={s.error}>
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
      )}
      {periods.isPending || (semesterId && query.isPending) ? (
        <OrganizationLoading />
      ) : semesterId ? (
        board ? (
          <>
            {board.plans.length === 0 && tab === "agenda" && (
              <div className={s.empty}>
                <h2>Use as turmas existentes como ponto de partida</h2>
                <p>
                  Horários, professores e alunos continuam juntos. Depois, revise apenas as exceções
                  e acomode quem está chegando.
                </p>
                <div className={s.actions}>
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
            )}
            {tab === "agenda" ? (
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
            ) : tab === "review" ? (
              <OrganizationReview
                key={semesterId}
                board={board}
                query={search}
                onAction={setAction}
                onFeedback={setFeedback}
              />
            ) : (
              <OrganizationCalendar board={board} onAction={setAction} />
            )}
          </>
        ) : null
      ) : (
        <div className={s.empty}>
          <h2>Comece pelo período letivo</h2>
          <p>
            Defina as datas reais do semestre. A estrutura de turmas poderá ser reaproveitada e
            ajustada ao longo do tempo.
          </p>
          <Button size="sm" onClick={() => setAction({ kind: "newSemester" })}>
            Criar semestre
          </Button>
        </div>
      )}
      {feedback && (
        <div className={s.feedback} role="status">
          <span>{feedback}</span>
          <Button
            className={s.push}
            size="sm"
            variant="ghost"
            aria-label="Dispensar mensagem"
            onClick={() => setFeedback("")}
          >
            <X size={14} />
          </Button>
        </div>
      )}
      {action &&
        (board ? (
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
        ) : action.kind === "newSemester" ? (
          <SemesterForm onClose={() => setAction(null)} onSaved={selectPeriod} />
        ) : null)}
    </section>
  );
}
