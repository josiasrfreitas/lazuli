"use client";

import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Alert } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { Choices, modes, type SemesterBoard, type StudentContext } from "./shared";
import { usePlacementModel, type PlacementModel, type PlacementProps } from "./placement-model";

type Stages = RouterOutputs["classes"]["formOptions"]["stages"];

export function PlacementFields(props: PlacementProps): ReactJSX.Element {
  const { data, row, board, onClose } = props;
  const options = trpc.classes.formOptions.useQuery();
  const model = usePlacementModel(props);
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title={row ? "Revisar alocação" : "Alocar aluno"}
      description={`${data.student.fullName} · semestre ${board.semester.name}`}
      formId="semester-placement"
      firstField="placement-source"
      submitLabel={model.planId === "pending" ? "Manter na fila" : "Salvar alocação"}
      onClose={onClose}
      pending={model.pending}
      error={model.error ?? options.error?.message}
      bodyRef={model.validation.body}
    >
      <PlacementFormBody data={data} board={board} model={model} stages={options.data?.stages} />
    </TaskDialog>
  );
}

function PlacementFormBody({
  data,
  board,
  model,
  stages,
}: {
  data: StudentContext;
  board: SemesterBoard;
  model: PlacementModel;
  stages: Stages | undefined;
}): ReactJSX.Element {
  return (
    <form id="semester-placement" noValidate className="grid gap-4 pt-4" onSubmit={model.submit}>
      <PlacementSourceControls data={data} model={model} />
      <PlacementDestinationControls board={board} model={model} stages={stages} />
      <PlacementWarnings data={data} model={model} />
      <NarrativeField
        name="placement-notes"
        label="Observações · opcional"
        placeholder="Horário desejado, preferência de modalidade ou motivo da pendência"
        value={model.notes}
        onChange={model.changeNotes}
        error={model.validation.errors.notes}
      />
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
        `${item.stage.internalCode} · ${item.enrollment.class.scheduleType === "PERSONALIZED" ? "PPT" : "Regular"}`,
      ]),
    ),
    new: "Nova entrada",
  };
  return (
    <>
      <Choices
        name="placement-source"
        label="Percurso de origem"
        value={model.sourceId}
        options={options}
        onChange={model.changeSource}
      />
      {model.sourceId !== "new" && (
        <Choices
          name="placement-mode"
          label="Próximo passo"
          value={model.mode}
          options={{ CONTINUE: modes.CONTINUE, ADVANCE: modes.ADVANCE, REPEAT: modes.REPEAT }}
          onChange={(value) => model.changeMode(value as keyof typeof modes)}
        />
      )}
    </>
  );
}

function PlacementDestinationControls({
  board,
  model,
  stages,
}: {
  board: SemesterBoard;
  model: PlacementModel;
  stages: Stages | undefined;
}): ReactJSX.Element {
  return (
    <>
      <SelectControl
        name="placement-plan"
        label="Turma"
        value={model.planId}
        onChange={model.changePlan}
        choices={[
          { value: "pending", label: "Ainda sem turma" },
          ...board.plans
            .filter((item) => item.active)
            .map((item) => ({ value: item.id, label: item.name })),
        ]}
        error={model.validation.errors.planId}
      />
      <StageDateControls model={model} stages={stages} />
    </>
  );
}

function StageDateControls({
  model,
  stages,
}: {
  model: PlacementModel;
  stages: Stages | undefined;
}): ReactJSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
        <Alert variant="warning">
          O cadastro está suspenso ou inativo. A proposta pode ser organizada, mas a publicação
          exige regularizar o aluno.
        </Alert>
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
