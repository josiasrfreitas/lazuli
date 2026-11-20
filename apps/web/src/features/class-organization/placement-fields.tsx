"use client";

import { useState, type JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { ToastAlert, Alert, Button } from "@lazuli/ui";
import { RecurringSchedule } from "~/features/students/new-student/intake-classes";
import { trpc } from "~/lib/trpc";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { ClassPlanForm } from "./plan-form";
import { suggestedPlans } from "./model";
import { Choices, modes, type OrganizationBoard, type StudentContext } from "./shared";
import { usePlacementModel, type PlacementModel, type PlacementProps } from "./placement-model";

type Stages = RouterOutputs["classes"]["formOptions"]["stages"];

export function PlacementFields(props: PlacementProps): ReactJSX.Element {
  const { data, board, onClose } = props;
  const options = trpc.classes.formOptions.useQuery();
  const model = usePlacementModel(props);
  const [creating, setCreating] = useState(false);
  if (creating)
    return (
      <ClassPlanForm
        semesterId={board.semester.id}
        initialStageId={props.row?.stageId ?? undefined}
        onClose={() => setCreating(false)}
        onSaved={(id) => {
          model.changePlan(id);
          setCreating(false);
        }}
      />
    );
  return (
    <TaskDialog
      compactHeader
      size="extra-wide"
      actionSize="sm"
      title="Escolher turma de destino"
      description={`${data.student.fullName} · semestre ${board.semester.name}`}
      formId="semester-placement"
      firstField={props.row?.continuity === "CHANGE" ? "" : "placement-source"}
      submitLabel={model.planId === "pending" ? "Manter na fila" : "Salvar proposta"}
      onClose={onClose}
      pending={model.pending}
      error={model.error ?? options.error?.message}
      bodyRef={model.validation.body}
    >
      <PlacementFormBody
        onCreate={() => setCreating(true)}
        row={props.row}
        data={data}
        board={board}
        model={model}
        stages={options.data?.stages}
      />
    </TaskDialog>
  );
}

function PlacementFormBody({
  onCreate,
  row,
  data,
  board,
  model,
  stages,
}: {
  onCreate: () => void;
  row: PlacementProps["row"];
  data: StudentContext;
  board: OrganizationBoard;
  model: PlacementModel;
  stages: Stages | undefined;
}): ReactJSX.Element {
  return (
    <form id="semester-placement" noValidate className="grid gap-4 pt-4" onSubmit={model.submit}>
      {row?.continuity !== "CHANGE" && <PlacementSourceControls data={data} model={model} />}
      <PlacementDestinationControls row={row} board={board} model={model} stages={stages} />
      <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={onCreate}>
        Criar turma vazia
      </Button>
      <PlacementWarnings data={data} model={model} />
      {!row && (
        <NarrativeField
          name="placement-notes"
          label="Observações · opcional"
          placeholder="Horário desejado, preferência de modalidade ou motivo da pendência"
          value={model.notes}
          onChange={model.changeNotes}
          error={model.validation.errors.notes}
        />
      )}
    </form>
  );
}

function PlacementSourceControls({
  data,
  model,
}: {
  data: StudentContext;
  model: PlacementModel;
}): ReactJSX.Element {
  const options = {
    ...Object.fromEntries(
      data.progress.map((item) => [
        item.id,
        `${item.enrollment.class.portalClassName} · ${item.stage.name} · ${item.enrollment.class.scheduleType === "PERSONALIZED" ? "PPT" : "Regular"}`,
      ]),
    ),
    new: "Nova turma",
  };
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-4 [&>*]:min-w-0 [&>*]:max-w-full [&>*]:w-auto">
      <Choices
        name="placement-source"
        label="De onde o aluno vem?"
        value={model.sourceId}
        options={options}
        onChange={model.changeSource}
      />
      {model.sourceId !== "new" && (
        <Choices
          name="placement-mode"
          label={model.regularRollover ? "Progressão de estágio" : "Estágio para o semestre"}
          value={model.mode}
          options={
            model.regularRollover
              ? { ADVANCE: "Avançar de estágio", REPEAT: "Repetir o estágio" }
              : { CONTINUE: modes.CONTINUE, ADVANCE: modes.ADVANCE, REPEAT: modes.REPEAT }
          }
          onChange={(value) => model.changeMode(value as keyof typeof modes)}
        />
      )}
    </div>
  );
}

function PlacementDestinationControls({
  row,
  board,
  model,
  stages,
}: {
  board: OrganizationBoard;
  model: PlacementModel;
  stages: Stages | undefined;
  row: PlacementProps["row"];
}): ReactJSX.Element {
  const changing = row?.continuity === "CHANGE";
  const plans = changing ? suggestedPlans(row, board) : board.plans.filter((plan) => plan.active);
  return (
    <>
      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-2 text-sm font-medium">
          Turma de destino{" "}
          {changing
            ? "· " + (row.stageName ?? row.stageCode ?? "Estágio a definir")
            : "em " + board.semester.name}
        </legend>
        {plans.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <RecurringSchedule
              choices={plans.map((plan) => ({
                id: plan.id,
                name: plan.name,
                stageName: plan.stageName ?? plan.name,
                teacherName: plan.teacherName ?? "Docente a definir",
                scheduleType: plan.scheduleType,
                format: plan.format,
                slots: plan.slots,
              }))}
              selectedId={model.planId}
              onSelect={(id) => model.changePlan(id || "pending")}
            />
          </div>
        ) : (
          <p className="text-caption text-muted-foreground">
            Nenhuma turma disponível para este destino.
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-fit"
          aria-pressed={model.planId === "pending"}
          onClick={() => model.changePlan("pending")}
        >
          Ainda sem turma
        </Button>
        {model.validation.errors.planId && (
          <p role="alert" className="text-caption text-destructive">
            {model.validation.errors.planId}
          </p>
        )}
      </fieldset>
      {model.planId !== "pending" && (
        <p className="text-caption text-muted-foreground">
          A proposta fica disponível em Revisar vínculos para aplicar a alocação.
        </p>
      )}
      <StageDateControls model={model} stages={stages} showStage={!changing} />
    </>
  );
}

function StageDateControls({
  model,
  stages,
  showStage,
}: {
  model: PlacementModel;
  stages: Stages | undefined;
  showStage: boolean;
}): ReactJSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {showStage && model.individualStage && (
        <SelectControl
          name="placement-stage"
          label="Estágio de destino"
          value={model.stageId}
          onChange={model.changeStage}
          choices={[
            { value: "pending", label: "A definir" },
            ...(stages ?? []).map((item) => ({
              value: item.id,
              label: `${item.internalCode} · ${item.name}`,
            })),
          ]}
          error={model.validation.errors.stageId}
        />
      )}
      <TextControl
        name="placement-effective"
        label="Válida a partir de"
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        value={model.effectiveDate}
        onChange={model.changeDate}
        error={model.validation.errors.effectiveDate}
      />
    </div>
  );
}

function PlacementWarnings({
  data,
  model,
}: {
  data: StudentContext;
  model: PlacementModel;
}): ReactJSX.Element {
  return (
    <>
      {model.source && (
        <p className="text-caption text-muted-foreground">
          Origem: {model.source.enrollment.class.portalClassName}. Resultado:{" "}
          {assessmentResult(model.source)}.
          {model.mode === "CONTINUE" ? " O estágio atual será mantido." : ""}
        </p>
      )}
      {data.student.status !== "ACTIVE" && (
        <ToastAlert variant="warning">
          O cadastro está suspenso ou inativo. A proposta pode ser organizada, mas a publicação
          exige regularizar o aluno.
        </ToastAlert>
      )}
      {model.stageId === "pending" && model.mode === "ADVANCE" && (
        <Alert>
          Não há próximo estágio indicado. A proposta permanece pendente para uma decisão
          pedagógica.
        </Alert>
      )}
    </>
  );
}

function assessmentResult(source: StudentContext["progress"][number]): string {
  if (!source.assessment?.confirmedAt) return "confirmação pendente";
  return source.assessment.decision === "APPROVED"
    ? "aprovação confirmada"
    : "repetência confirmada";
}
