"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { parseAsString, useQueryStates } from "nuqs";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarRange, Plus, Users } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Tabs, TabsList, TabsTab } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { SelectControl } from "~/features/classes/form-controls";
import { RecordState } from "~/features/class-records/shared";
import { today } from "~/features/appointments/shared";
import {
  dateOnly,
  scheduleLabel,
  type ClassPlan,
  type Placement,
  type SemesterBoard,
} from "./shared";
import { ClassPlanForm, SemesterForm } from "./plan-form";
import { SemesterRoster, type PlacementAction } from "./roster";
import { StudentPool } from "./student-pool";
import { PlacementForm } from "./placement-form";
import { AvailabilityForm } from "./availability-form";
import { ReasonDialog, PlacementHistory } from "./action-dialogs";

type Action =
  | PlacementAction
  | { kind: "newPlacement"; studentId: string }
  | { kind: "invalidate"; row: Placement; previousId: string };
export function SemesterOrganizationPage(): ReactJSX.Element {
  const [params, setParams] = useQueryStates({
    semestre: parseAsString,
    turma: parseAsString,
    visao: parseAsString.withDefault("turmas"),
  });
  const semesters = trpc.semesterOrganization.semesters.useQuery();
  const upcoming = [...(semesters.data ?? [])]
    .reverse()
    .find((item) => dateOnly(item.startDate) > today());
  const semesterId = params.semestre ?? upcoming?.id ?? semesters.data?.[0]?.id;
  const query = trpc.semesterOrganization.detail.useQuery(
    { semesterId: semesterId ?? "" },
    { enabled: Boolean(semesterId) },
  );
  const [planForm, setPlanForm] = useState<ClassPlan | "new" | null>(null);
  const [semesterForm, setSemesterForm] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const board = query.data;
  const readOnly = board ? dateOnly(board.semester.startDate) <= today() : true;
  const selectedPlan = board?.plans.find((plan) => plan.id === params.turma);
  const selectedRows =
    board?.placements.filter((row) =>
      params.turma === "unassigned" ? !row.planId : row.planId === selectedPlan?.id,
    ) ?? [];
  const selectPlan = (id: string | null) => void setParams({ turma: id, visao: "turmas" });
  return (
    <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-1 content-start gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-micro font-semibold uppercase tracking-widest text-muted-foreground">
            Organização pedagógica
          </p>
          <h1 className="font-display text-h2 font-semibold text-heading">Próximo semestre</h1>
          <p className="mt-2 max-w-xl text-caption text-muted-foreground">
            Turmas, horários e alocações para o próximo período.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-36">
            <SelectControl
              name="organization-semester"
              label="Semestre"
              hideLabel
              value={semesterId ?? ""}
              onChange={(value) => void setParams({ semestre: value, turma: null })}
              choices={(semesters.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => setSemesterForm(true)}>
            Novo semestre
          </Button>
        </div>
      </header>
      <RecordState
        pending={semesters.isPending || (Boolean(semesterId) && query.isPending)}
        error={semesters.error ?? query.error}
        retry={() => {
          void semesters.refetch();
          void query.refetch();
        }}
      />
      {board && (
        <>
          <SemesterSummary board={board} />
          {readOnly && (
            <Alert>
              Este semestre já começou. Consulte a organização e continue as movimentações pela
              página da turma.
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <Tabs
              variant="underline"
              value={params.visao}
              onValueChange={(value) => void setParams({ visao: value, turma: null })}
            >
              <TabsList aria-label="Organização do semestre">
                <TabsTab value="turmas">Turmas planejadas</TabsTab>
                <TabsTab value="alunos">Alunos a organizar</TabsTab>
              </TabsList>
            </Tabs>
            {params.visao === "turmas" && !params.turma && !readOnly && (
              <Button onClick={() => setPlanForm("new")}>
                <Plus />
                Planejar turma
              </Button>
            )}
          </div>
          {params.visao === "alunos" ? (
            <StudentPool
              key={board.semester.id}
              board={board}
              readOnly={readOnly}
              onOrganize={(studentId) => {
                const row = board.placements.find((item) => item.studentId === studentId);
                setAction(
                  row
                    ? { kind: row.publishedAt ? "history" : "edit", row }
                    : { kind: "newPlacement", studentId },
                );
              }}
            />
          ) : params.turma && (selectedPlan || params.turma === "unassigned") ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-2">
                  <div>
                    <Button variant="ghost" size="sm" onClick={() => selectPlan(null)}>
                      <ArrowLeft />
                      Todas as turmas
                    </Button>
                  </div>
                  <h2 className="font-display text-h3 font-semibold text-heading">
                    {selectedPlan?.name ?? "Ainda sem turma"}
                  </h2>
                  {selectedPlan && (
                    <p className="text-caption text-muted-foreground">
                      {selectedPlan.teacherName ?? "Professor a definir"} ·{" "}
                      {selectedPlan.format === "ONLINE" ? "Online" : "Presencial"}
                      <br />
                      {scheduleLabel(selectedPlan.slots)}
                    </p>
                  )}
                </div>
                {selectedPlan && (
                  <div className="flex flex-wrap gap-2">
                    {selectedPlan.classId ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        render={<Link href={`/turmas/${selectedPlan.classId}`} />}
                      >
                        Abrir turma
                        <ArrowUpRight />
                      </Button>
                    ) : (
                      !readOnly && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPlanForm(selectedPlan)}
                        >
                          Revisar turma
                        </Button>
                      )
                    )}
                  </div>
                )}
              </div>
              {selectedPlan?.draftConflicts.length ? (
                <Alert variant="warning">
                  Horário do professor também proposto em {selectedPlan.draftConflicts.join(", ")}.
                  Revise a composição antes de publicar ambas as turmas.
                </Alert>
              ) : null}
              <SemesterRoster
                key={params.turma}
                board={board}
                plan={selectedPlan}
                rows={selectedRows}
                readOnly={readOnly}
                onAction={setAction}
              />
            </>
          ) : (
            <PlanOverview board={board} onSelect={selectPlan} />
          )}
          {planForm && (
            <ClassPlanForm
              semesterId={board.semester.id}
              {...(planForm === "new" ? {} : { plan: planForm })}
              onClose={() => setPlanForm(null)}
              onSaved={selectPlan}
            />
          )}
          {(action?.kind === "edit" || action?.kind === "newPlacement") && (
            <PlacementForm
              studentId={action.kind === "newPlacement" ? action.studentId : action.row.studentId}
              {...(action.kind === "edit" ? { row: action.row } : {})}
              board={board}
              onClose={() => setAction(null)}
            />
          )}
          {action?.kind === "availability" && (
            <AvailabilityForm
              studentId={action.row.studentId}
              board={board}
              onClose={() => setAction(null)}
              onInvalidate={(previousId) =>
                setAction({ kind: "invalidate", row: action.row, previousId })
              }
            />
          )}
          {(action?.kind === "withdraw" || action?.kind === "invalidate") && (
            <ReasonDialog
              action={action.kind}
              row={action.row}
              {...(action.kind === "invalidate" ? { previousId: action.previousId } : {})}
              board={board}
              onClose={() => setAction(null)}
            />
          )}
          {action?.kind === "history" && (
            <PlacementHistory row={action.row} onClose={() => setAction(null)} />
          )}
        </>
      )}
      {!semesters.isPending && !semesters.isError && !semesters.data?.length && (
        <EmptyState
          icon={<CalendarRange />}
          title="Organize o próximo período"
          description="Cadastre o semestre para preparar turmas e alunos."
          action={<Button onClick={() => setSemesterForm(true)}>Criar semestre</Button>}
        />
      )}
      {semesterForm && (
        <SemesterForm
          onClose={() => setSemesterForm(false)}
          onSaved={(id) => void setParams({ semestre: id, turma: null })}
        />
      )}
    </div>
  );
}
function SemesterSummary({ board }: { board: SemesterBoard }): ReactJSX.Element {
  const published = board.placements.filter((row) => row.publishedAt).length;
  const ready = board.placements.filter(
    (row) => !row.publishedAt && row.blockers.length === 0,
  ).length;
  const pending = board.placements.filter((row) => row.blockers.length).length;
  const metrics = [
    [
      "Alunos publicados",
      published,
      `${board.plans.filter((plan) => plan.classId).length} turmas já abertas`,
    ],
    ["Prontos para publicar", ready, "Disponibilidade e percurso conferidos"],
    ["Com pendências", pending, "Acadêmicas, de horário ou de cadastro"],
    [
      "Alunos sem proposta",
      board.studentsTotal - board.studentsProposed,
      `De ${board.studentsTotal} alunos cadastrados`,
    ],
  ] as const;
  return (
    <section
      aria-label="Resumo da organização"
      className="grid grid-cols-2 gap-x-5 gap-y-6 border-y border-border py-5 lg:grid-cols-4"
    >
      {metrics.map(([label, value, detail], index) => (
        <div key={label} className="grid content-start gap-1.5">
          <p className="text-caption text-muted-foreground">{label}</p>
          <p
            className={
              index === 0
                ? "font-numeric text-h2 font-semibold tabular-nums text-interactive"
                : "font-numeric text-h2 font-semibold tabular-nums text-heading"
            }
          >
            {value}
          </p>
          <p className="text-micro text-muted-foreground">{detail}</p>
        </div>
      ))}
    </section>
  );
}
function PlanOverview({
  board,
  onSelect,
}: {
  board: SemesterBoard;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  const unassigned = board.placements.filter((row) => !row.planId);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-muted-foreground">
          {board.plans.length} turmas planejadas · entrada em{" "}
          {formatDateOnlyBR(dateOnly(board.semester.startDate))}
        </p>
        <p className="text-micro text-muted-foreground">
          Publicação parcial · referência de 25 alunos por turma
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {board.plans.map((plan) => {
          const rows = board.placements.filter((row) => row.planId === plan.id);
          const published = rows.filter((row) => row.publishedAt).length;
          const pending = rows.filter((row) => row.blockers.length).length;
          return (
            <button
              type="button"
              key={plan.id}
              onClick={() => onSelect(plan.id)}
              className="group grid content-start gap-5 rounded-md border border-border bg-card p-5 text-left transition-colors hover:border-interactive focus-visible:outline-none focus-visible:shadow-focus"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={plan.classId ? "info" : "neutral"}>
                      {plan.classId ? "Publicação iniciada" : "Em preparação"}
                    </Badge>
                    <span className="text-micro text-muted-foreground">
                      {plan.scheduleType === "PERSONALIZED" ? "PPT" : plan.stageCode} ·{" "}
                      {plan.format === "ONLINE" ? "Online" : "Presencial"}
                    </span>
                  </div>
                  <h3 className="font-display text-h4 font-semibold text-heading">{plan.name}</h3>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-interactive" />
              </div>
              <div className="grid gap-1">
                <p className="text-caption">{plan.teacherName ?? "Professor a definir"}</p>
                <p className="text-caption text-muted-foreground">{scheduleLabel(plan.slots)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <span className="inline-flex items-center gap-2 text-caption">
                  <Users className="size-4 text-muted-foreground" />
                  {rows.length} {rows.length === 1 ? "aluno" : "alunos"} · {published} publicados
                </span>
                <span className="text-micro text-muted-foreground">
                  {pending
                    ? `${pending} ${pending === 1 ? "pendente" : "pendentes"}`
                    : rows.length > 0
                      ? "Tudo conferido"
                      : "A compor"}
                </span>
              </div>
              {plan.draftConflicts.length > 0 && (
                <p className="text-caption text-warning-foreground">
                  Conflito entre propostas do professor
                </p>
              )}
            </button>
          );
        })}
      </div>
      {unassigned.length > 0 && (
        <button
          type="button"
          onClick={() => onSelect("unassigned")}
          className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border p-4 text-left focus-visible:outline-none focus-visible:shadow-focus"
        >
          <div>
            <p className="text-caption font-semibold">
              {unassigned.length}{" "}
              {unassigned.length === 1 ? "aluno ainda sem turma" : "alunos ainda sem turma"}
            </p>
            <p className="mt-1 text-caption text-muted-foreground">
              Acompanhe decisões de estágio e propostas que precisam de um destino.
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0" />
        </button>
      )}
      {board.plans.length === 0 && (
        <EmptyState
          title="O próximo semestre começa aqui"
          description="Planeje a primeira turma e organize os alunos conforme os horários e o percurso de cada um."
        />
      )}
    </div>
  );
}
