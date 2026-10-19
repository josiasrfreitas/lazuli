"use client";
import { useState } from "react";
import { Alert, InlineSkeleton } from "@lazuli/ui";
import { semesterPlacementSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { RecordState } from "~/features/class-records/shared";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
import {
  Choices,
  dateOnly,
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
  const options = trpc.classes.formOptions.useQuery();
  return query.data && options.data ? (
    <PlacementFields
      data={query.data}
      row={row}
      board={board}
      initialPlanId={initialPlanId}
      onClose={onClose}
    />
  ) : (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title={row ? "Revisar proposta" : "Organizar aluno"}
      description={`${row?.studentName ?? "Aluno"} · semestre ${board.semester.name}`}
      bodyClassName="min-h-80"
      submitDisabled
      formId="placement-loading"
      firstField=""
      submitLabel="Carregando…"
      pending={false}
      onClose={onClose}
    >
      {query.isPending || options.isPending ? (
        <div className="grid gap-4 py-4" role="status" aria-label="Carregando dados do aluno">
          <InlineSkeleton className="h-12 w-full" />
          <InlineSkeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <InlineSkeleton className="h-12 w-full" />
            <InlineSkeleton className="h-12 w-full" />
          </div>
          <InlineSkeleton className="h-20 w-full" />
        </div>
      ) : (
        <RecordState
          pending={false}
          error={query.error ?? options.error}
          retry={() => {
            void query.refetch();
            void options.refetch();
          }}
        />
      )}
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
  const [sourceId, setSourceId] = useState(
    row ? (row.sourceProgressId ?? "new") : (initialSource?.id ?? "new"),
  );
  const defaultMode = initialSource ? "CONTINUE" : "ENTRY";
  const [mode, setMode] = useState<keyof typeof modes>(row?.mode ?? defaultMode);
  const suggestedStage = initialSource?.stageId ?? data.lead?.stageId;
  const [stageId, setStageId] = useState(
    row ? (row.stageId ?? "pending") : (suggestedStage ?? "pending"),
  );
  const [planId, setPlanId] = useState(initialPlanId ?? row?.planId ?? "pending");
  const [effectiveDate, setEffectiveDate] = useState(
    formatDateOnlyBR(
      row?.effectiveDate
        ? dateOnly(row.effectiveDate)
        : [dateOnly(board.semester.startDate), toDateOnlySaoPaulo(new Date())].sort().at(-1)!,
    ),
  );
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
  function changeMode(
    next: keyof typeof modes,
    progress: StudentContext["progress"][number] | undefined,
  ) {
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
      compactHeader
      actionSize="sm"
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
            effectiveDate: parseDateBR(effectiveDate) ?? "",
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
            changeMode(progress ? "CONTINUE" : "ENTRY", progress);
          }}
        />
        {sourceId !== "new" && (
          <Choices
            name="placement-mode"
            label="Próximo passo"
            value={mode}
            options={{ CONTINUE: modes.CONTINUE, ADVANCE: modes.ADVANCE, REPEAT: modes.REPEAT }}
            onChange={(value) => changeMode(value as keyof typeof modes, source)}
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
        <div className="grid gap-3 sm:grid-cols-2">
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
          <TextControl
            name="placement-effective"
            label="Válida a partir de"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            value={effectiveDate}
            onChange={(value) => {
              setEffectiveDate(maskDateBR(value));
              validation.clear("effectiveDate");
            }}
            error={validation.errors.effectiveDate}
          />
        </div>
        {source && (
          <p className="text-caption text-muted-foreground">
            Origem: {source.enrollment.class.portalClassName}. Resultado:{" "}
            {source.assessment?.confirmedAt
              ? source.assessment.decision === "APPROVED"
                ? "aprovação confirmada"
                : "repetência confirmada"
              : "confirmação pendente"}
            .{mode === "CONTINUE" ? " O estágio atual será mantido." : ""}
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
