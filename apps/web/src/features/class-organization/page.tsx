"use client";
import { useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { CalendarRange, Copy, Plus, X, MoreHorizontal } from "lucide-react";
import {
  Button,
  Input,
  InlineSkeleton,
  SegmentedControl,
  SegmentedControlItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@lazuli/ui";
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

export function OrganizationLoading() {
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
export function ClassOrganizationPage() {
  const [selectedPeriod, setSelectedPeriod] = useQueryState(
    "semestre",
    parseAsString.withDefault(""),
  );
  const [tab, setTab] = useQueryState("visao", parseAsString.withDefault("agenda"));
  const [search, setSearch] = useState("");
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
  function selectPeriod(id: string) {
    void setSelectedPeriod(id);
    setPlanId(null);
    setAction(null);
    setFeedback("");
  }
  const active = board?.placements.filter((row) => !row.declinedAt) ?? [];
  const pending = active.filter((row) => !row.planId || (!row.publishedAt && row.blockers.length));
  const pendingCount = pending.length + (board?.intents.length ?? 0);
  const ready = active.filter((row) => !row.publishedAt && !row.blockers.length);
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
              label="Semestre"
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
              ? "Próximo período · preparação em andamento"
              : ended
                ? "Período encerrado"
                : "Semestre em andamento · ajustes contínuos")}
        </span>
        <div className={`${s.actions} ${s.push}`}>
          <span className={s.busy} role="status">
            {(query.isFetching && board) || prepare.isPending ? "Atualizando…" : ""}
          </span>
          <Button
            size="sm"
            disabled={!board || ended}
            onClick={() => setAction({ kind: "findStudent" })}
          >
            <Plus size={14} /> Aluno
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!board || ended}
            onClick={() => setAction({ kind: "plan" })}
          >
            <Plus size={14} /> Turma
          </Button>
          <Popover open={setupOpen} onOpenChange={setSetupOpen}>
            <PopoverTrigger
              render={<Button size="sm" variant="ghost" aria-label="Opções do semestre" />}
            >
              <MoreHorizontal size={16} />
            </PopoverTrigger>
            <PopoverContent align="end" size="md">
              <div className="grid gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!board || ended || prepare.isPending}
                  onClick={() => {
                    setSetupOpen(false);
                    prepare.mutate({ semesterId });
                  }}
                >
                  <Copy size={14} /> Incorporar base
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSetupOpen(false);
                    setAction({ kind: "newSemester" });
                  }}
                >
                  <CalendarRange size={14} /> Novo semestre
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>
      <div className={s.toolbar}>
        <SegmentedControl
          size="sm"
          value={tab}
          onValueChange={(value) => {
            if (value) {
              void setTab(value);
              setSearch("");
            }
          }}
          aria-label="Área de trabalho"
        >
          <SegmentedControlItem value="agenda">Turmas e alunos</SegmentedControlItem>
          <SegmentedControlItem value="review">
            Revisão{ready.length ? ` · ${ready.length}` : ""}
          </SegmentedControlItem>
          <SegmentedControlItem value="calendar">Calendário letivo</SegmentedControlItem>
        </SegmentedControl>
        <div className={s.stats}>
          <span>
            <strong>{board?.plans.length ?? "—"}</strong> turmas
          </span>
          <span>
            <strong>
              {board
                ? new Set([
                    ...active.map((row) => row.studentId),
                    ...(board?.intents ?? []).map((row) => row.studentId),
                  ]).size
                : "—"}
            </strong>{" "}
            alunos
          </span>
          <span className={pendingCount ? s.attention : undefined}>
            <strong>{board ? pendingCount : "—"}</strong> a acomodar
          </span>
        </div>
        {tab !== "calendar" && (
          <Input
            size="sm"
            className={`${s.search} ${s.push}`}
            aria-label={tab === "review" ? "Buscar aluno na revisão" : "Buscar turma ou professor"}
            placeholder={tab === "review" ? "Buscar aluno…" : "Turma ou professor…"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
      </div>
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
      ) : !semesterId ? (
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
      ) : board ? (
        <>
          {!board.plans.length && tab === "agenda" ? (
            <div className={s.empty}>
              <h2>Use as turmas existentes como ponto de partida</h2>
              <p>
                Horários, professores e alunos continuam juntos. Depois, revise apenas as exceções e
                acomode quem está chegando.
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
          ) : tab === "agenda" ? (
            <OrganizationAgenda
              key={semesterId}
              board={board}
              query={search}
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
      ) : null}
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
