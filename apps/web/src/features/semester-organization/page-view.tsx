"use client";

import type { JSX as ReactJSX } from "react";
import { CalendarRange, Plus } from "lucide-react";
import { Alert, Button, EmptyState, Tabs, TabsList, TabsTab } from "@lazuli/ui";
import { SelectControl } from "~/features/classes/form-controls";
import { RecordState } from "~/features/class-records/shared";
import { StudentPool } from "./student-pool";
import { PlanOverview } from "./plan-overview";
import { SemesterSummary } from "./page-summary";
import { SelectedPlan } from "./selected-plan";
import { SemesterForm } from "./plan-form";
import { BoardDialogs } from "./page-dialogs";
import { useSemesterPageModel, type SemesterPageModel } from "./page-model";
import type { SemesterBoard } from "./shared";

export function SemesterOrganizationPage(): ReactJSX.Element {
  const model = useSemesterPageModel();
  return (
    <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-1 content-start gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <SemesterPageHeader model={model} />
      <RecordState
        pending={model.semesters.isPending || (Boolean(model.semesterId) && model.query.isPending)}
        error={model.semesters.error ?? model.query.error}
        retry={() => {
          void model.semesters.refetch();
          void model.query.refetch();
        }}
      />
      {model.board && <SemesterBoardView board={model.board} model={model} />}
      {!model.semesters.isPending && !model.semesters.isError && !model.semesters.data?.length && (
        <EmptyState
          icon={<CalendarRange />}
          title="Organize o próximo período"
          description="Cadastre o semestre para preparar turmas e alunos."
          action={<Button onClick={() => model.setSemesterForm(true)}>Criar semestre</Button>}
        />
      )}
      {model.semesterForm && (
        <SemesterForm onClose={() => model.setSemesterForm(false)} onSaved={model.selectSemester} />
      )}
    </div>
  );
}

function SemesterPageHeader({ model }: { model: SemesterPageModel }): ReactJSX.Element {
  return (
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
            value={model.semesterId ?? ""}
            onChange={model.selectSemester}
            choices={(model.semesters.data ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
        </div>
        <Button size="sm" variant="secondary" onClick={() => model.setSemesterForm(true)}>
          Novo semestre
        </Button>
      </div>
    </header>
  );
}

function SemesterBoardView({
  board,
  model,
}: {
  board: SemesterBoard;
  model: SemesterPageModel;
}): ReactJSX.Element {
  return (
    <>
      <SemesterSummary board={board} />
      {model.readOnly && (
        <Alert>
          Este semestre já começou. Consulte a organização e continue as movimentações pela página
          da turma.
        </Alert>
      )}
      <BoardNavigation model={model} />
      <BoardBody board={board} model={model} />
      <BoardDialogs board={board} model={model} />
    </>
  );
}

function BoardNavigation({ model }: { model: SemesterPageModel }): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <Tabs
        variant="underline"
        value={model.params.visao}
        onValueChange={(value) => {
          if (typeof value === "string") model.selectView(value);
        }}
      >
        <TabsList aria-label="Organização do semestre">
          <TabsTab value="turmas">Turmas planejadas</TabsTab>
          <TabsTab value="alunos">Alunos a organizar</TabsTab>
        </TabsList>
      </Tabs>
      {model.params.visao === "turmas" && !model.params.turma && !model.readOnly && (
        <Button onClick={() => model.setPlanForm("new")}>
          <Plus />
          Planejar turma
        </Button>
      )}
    </div>
  );
}

function BoardBody({
  board,
  model,
}: {
  board: SemesterBoard;
  model: SemesterPageModel;
}): ReactJSX.Element {
  if (model.params.visao === "alunos") {
    return (
      <StudentPool
        key={board.semester.id}
        board={board}
        readOnly={model.readOnly}
        onOrganize={model.organizeStudent}
      />
    );
  }
  if (model.params.turma && (model.selectedPlan || model.params.turma === "unassigned")) {
    return (
      <SelectedPlan
        board={board}
        plan={model.selectedPlan}
        rows={model.selectedRows}
        readOnly={model.readOnly}
        selectedId={model.params.turma}
        onBack={() => model.selectPlan(null)}
        onReview={model.setPlanForm}
        onAction={model.setAction}
      />
    );
  }
  return <PlanOverview board={board} onSelect={model.selectPlan} />;
}
