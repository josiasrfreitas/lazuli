"use client";
import { useState } from "react";
import { Alert } from "@lazuli/ui";
import { semesterPlacementSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { RecordState } from "~/features/class-records/shared";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
import {
  Choices,
  modes,
  useOrganizationRefresh,
  type Placement,
  type SemesterBoard,
  type StudentContext,
} from "./shared";

export function PlacementForm({
  studentId,
  row,
  board,
  initialPlanId,
  onClose,
}: {
  studentId: string;
  row?: Placement;
  board: SemesterBoard;
  initialPlanId?: string;
  onClose: () => void;
}) {
  const query = trpc.semesterOrganization.student.useQuery({
    studentId,
    semesterId: board.semester.id,
  });
  return query.data ? (
    <PlacementFields
      data={query.data}
      row={row}
      board={board}
      initialPlanId={initialPlanId}
      onClose={onClose}
    />
  ) : (
    <TaskDialog
      title="Organizar aluno"
      description="Carregando percurso acadêmico…"
      formId="placement-loading"
      firstField=""
      submitLabel="Carregando…"
      pending={false}
      onClose={onClose}
    >
      <RecordState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
    </TaskDialog>
  );
}
function PlacementFields({
  data,
  row,
  board,
  initialPlanId,
  onClose,
}: {
  data: StudentContext;
  row?: Placement | undefined;
  board: SemesterBoard;
  initialPlanId?: string | undefined;
  onClose: () => void;
}) {
  const options = trpc.classes.formOptions.useQuery();
  const initialSource =
    data.progress.find((item) => item.id === row?.sourceProgressId) ?? data.progress[0];
  const [sourceId, setSourceId] = useState(row?.sourceProgressId ?? initialSource?.id ?? "new");
  const defaultMode = initialSource
    ? initialSource.enrollment.class.scheduleType === "PERSONALIZED"
      ? "CONTINUE"
      : initialSource.assessment?.decision === "REPEAT"
        ? "REPEAT"
        : "ADVANCE"
    : "ENTRY";
  const [mode, setMode] = useState<keyof typeof modes>(row?.mode ?? defaultMode);
  const suggestedStage = initialSource
    ? defaultMode === "ADVANCE"
      ? initialSource.stage.track.stages.find(
          (item) => item.sequence === initialSource.stage.sequence + 1,
        )?.id
      : initialSource.stageId
    : data.lead?.stageId;
  const [stageId, setStageId] = useState(
    row ? (row.stageId ?? "pending") : (suggestedStage ?? "pending"),
  );
  const [planId, setPlanId] = useState(row?.planId ?? initialPlanId ?? "pending");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const source = data.progress.find((item) => item.id === sourceId);
  const mutation = trpc.semesterOrganization.savePlacement.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  function changeMode(next: keyof typeof modes, progress = source) {
    setMode(next);
    setStageId(
      progress
        ? next === "ADVANCE"
          ? (progress.stage.track.stages.find(
              (item) => item.sequence === progress.stage.sequence + 1,
            )?.id ?? "pending")
          : progress.stageId
        : (data.lead?.stageId ?? "pending"),
    );
    validation.clear("stageId");
    validation.clear("mode");
  }
  return (
    <TaskDialog
      title={row ? "Revisar proposta" : "Organizar aluno"}
      description={`${data.student.fullName} · semestre ${board.semester.name}`}
      formId="semester-placement"
      firstField="placement-source"
      submitLabel="Salvar proposta"
      onClose={onClose}
      pending={mutation.isPending}
      error={mutation.error?.message ?? options.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="semester-placement"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = validation.validate(semesterPlacementSchema, {
            ...(row ? { id: row.id } : {}),
            version: row?.version ?? 0,
            semesterId: board.semester.id,
            studentId: data.student.id,
            planId: planId === "pending" ? null : planId,
            stageId: stageId === "pending" ? null : stageId,
            sourceProgressId: sourceId === "new" ? null : sourceId,
            mode,
            notes,
          });
          if (values && !mutation.isPending) mutation.mutate(values);
        }}
      >
        <Choices
          name="placement-source"
          label="Percurso de origem"
          value={sourceId}
          options={{
            ...Object.fromEntries(
              data.progress.map((item) => [
                item.id,
                `${item.stage.internalCode} · ${item.enrollment.class.scheduleType === "PERSONALIZED" ? "PPT" : "Regular"}`,
              ]),
            ),
            new: "Nova entrada",
          }}
          onChange={(value) => {
            setSourceId(value);
            const progress = data.progress.find((item) => item.id === value);
            changeMode(
              progress
                ? progress.enrollment.class.scheduleType === "PERSONALIZED"
                  ? "CONTINUE"
                  : progress.assessment?.decision === "REPEAT"
                    ? "REPEAT"
                    : "ADVANCE"
                : "ENTRY",
              progress,
            );
          }}
        />
        {sourceId !== "new" && (
          <Choices
            name="placement-mode"
            label="Próximo passo"
            value={mode}
            options={{ CONTINUE: modes.CONTINUE, ADVANCE: modes.ADVANCE, REPEAT: modes.REPEAT }}
            onChange={(value) => changeMode(value as keyof typeof modes)}
          />
        )}
        <SelectControl
          name="placement-plan"
          label="Turma planejada"
          value={planId}
          onChange={(value) => {
            setPlanId(value);
            const plan = board.plans.find((item) => item.id === value);
            if (plan?.sharedStageId) setStageId(plan.sharedStageId);
            validation.clear("planId");
          }}
          choices={[
            { value: "pending", label: "Ainda sem turma" },
            ...board.plans.map((item) => ({ value: item.id, label: item.name })),
          ]}
          error={validation.errors.planId}
        />
        <SelectControl
          name="placement-stage"
          label="Estágio de destino"
          value={stageId}
          onChange={(value) => {
            setStageId(value);
            validation.clear("stageId");
          }}
          choices={[
            { value: "pending", label: "A definir" },
            ...(options.data?.stages ?? []).map((item) => ({
              value: item.id,
              label: `${item.internalCode} · ${item.name}`,
            })),
          ]}
          error={validation.errors.stageId}
        />
        {source && (
          <p className="text-caption text-muted-foreground">
            Origem: {source.enrollment.class.portalClassName}. Resultado:{" "}
            {source.assessment?.confirmedAt
              ? source.assessment.decision === "APPROVED"
                ? "aprovação confirmada"
                : "repetência confirmada"
              : "confirmação pendente"}
            .{mode === "CONTINUE" ? " O plano e a avaliação PPT acompanham o aluno." : ""}
          </p>
        )}
        {data.student.status !== "ACTIVE" && (
          <Alert variant="warning">
            O cadastro está suspenso ou inativo. A proposta pode ser organizada, mas a publicação
            exige regularizar o aluno.
          </Alert>
        )}
        {stageId === "pending" && mode === "ADVANCE" && (
          <Alert>
            Não há próximo estágio indicado. A proposta permanece pendente para uma decisão
            pedagógica.
          </Alert>
        )}
        <NarrativeField
          name="placement-notes"
          label="Observações · opcional"
          placeholder="Contexto para organizar a próxima etapa do aluno"
          value={notes}
          onChange={(value) => {
            setNotes(value);
            validation.clear("notes");
          }}
          error={validation.errors.notes}
        />
      </form>
    </TaskDialog>
  );
}
