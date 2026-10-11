"use client";
import { useState } from "react";
import { semesterPlanSchema, createSemesterInputSchema } from "@lazuli/validators";
import { Alert } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { Choices, useOrganizationRefresh, type ClassPlan } from "./shared";
import { SlotFields, type SlotDraft } from "./slot-fields";

export function ClassPlanForm({
  semesterId,
  plan,
  onClose,
  onSaved,
}: {
  semesterId: string;
  plan?: ClassPlan;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const options = trpc.classes.formOptions.useQuery();
  const [name, setName] = useState(plan?.name ?? "");
  const [kind, setKind] = useState(plan?.scheduleType ?? "REGULAR");
  const [format, setFormat] = useState(plan?.format ?? "IN_PERSON");
  const [teacher, setTeacher] = useState(plan?.teacherId ?? "pending");
  const [stage, setStage] = useState(plan?.sharedStageId ?? "");
  const [slots, setSlots] = useState<SlotDraft[]>(
    plan?.slots ?? [
      { weekday: "MONDAY", startTime: "", endTime: "" },
      { weekday: "WEDNESDAY", startTime: "", endTime: "" },
    ],
  );
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.savePlan.useMutation({
    onSuccess: async (result) => {
      await refresh();
      onSaved(result.id);
      onClose();
    },
  });
  const change = (field: string, setter: (value: string) => void) => (value: string) => {
    setter(value);
    validation.clear(field);
  };
  return (
    <TaskDialog
      title={plan ? "Revisar turma planejada" : "Planejar turma"}
      description="Defina a composição inicial. Você pode publicar os alunos aos poucos."
      formId="semester-plan"
      firstField="plan-name"
      submitLabel="Salvar turma"
      onClose={onClose}
      pending={mutation.isPending}
      error={mutation.error?.message ?? options.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="semester-plan"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = validation.validate(semesterPlanSchema, {
            ...(plan ? { id: plan.id } : {}),
            version: plan?.version ?? 0,
            semesterId,
            name,
            scheduleType: kind,
            format,
            teacherId: teacher === "pending" ? null : teacher,
            sharedStageId: kind === "REGULAR" ? stage || null : null,
            slots,
          });
          if (values && !mutation.isPending) mutation.mutate(values);
        }}
      >
        <TextControl
          name="plan-name"
          label="Nome da turma planejada"
          placeholder="Connect 2 · tarde"
          value={name}
          onChange={change("name", setName)}
          error={validation.errors.name}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Choices
            name="plan-kind"
            label="Modalidade"
            value={kind}
            options={{ REGULAR: "Regular", PERSONALIZED: "PPT" }}
            onChange={(value) => {
              setKind(value as typeof kind);
              validation.clear("sharedStageId");
            }}
          />
          <Choices
            name="plan-format"
            label="Formato"
            value={format}
            options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
            onChange={(value) => setFormat(value as typeof format)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectControl
            name="plan-teacher"
            label="Professor"
            value={teacher}
            onChange={change("teacherId", setTeacher)}
            choices={[
              { value: "pending", label: "Definir depois" },
              ...(options.data?.teachers ?? []).map((row) => ({ value: row.id, label: row.name })),
            ]}
            error={validation.errors.teacherId}
          />
          {kind === "REGULAR" && (
            <SelectControl
              name="plan-stage"
              label="Estágio compartilhado"
              value={stage}
              onChange={change("sharedStageId", setStage)}
              choices={(options.data?.stages ?? []).map((row) => ({
                value: row.id,
                label: `${row.internalCode} · ${row.name}`,
              }))}
              error={validation.errors.sharedStageId}
            />
          )}
        </div>
        <SlotFields
          slots={slots}
          onChange={(value) => {
            setSlots(value);
            validation.clear("slots");
          }}
          error={validation.errors.slots}
        />
        <p className="text-caption text-muted-foreground">
          Até 2 horas por semana. Referência de 25 alunos; o professor pode ser definido antes da
          publicação.
        </p>
      </form>
    </TaskDialog>
  );
}
export function SemesterForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const mutation = trpc.calendar.createSemester.useMutation({
    onSuccess: async (result) => {
      await refresh();
      onSaved(result.semester.id);
      onClose();
    },
  });
  return (
    <TaskDialog
      title="Novo semestre"
      description="O período acadêmico organiza as aulas e as futuras matrículas."
      formId="semester-create"
      firstField="semester-name"
      submitLabel="Criar semestre"
      onClose={onClose}
      pending={mutation.isPending}
      error={mutation.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="semester-create"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = validation.validate(createSemesterInputSchema, {
            name,
            startDate: parseDateBR(start) ?? "",
            endDate: parseDateBR(end) ?? "",
          });
          if (values && !mutation.isPending) mutation.mutate(values);
        }}
      >
        <TextControl
          name="semester-name"
          label="Nome"
          placeholder="2027.1"
          value={name}
          onChange={(value) => {
            setName(value);
            validation.clear("name");
          }}
          error={validation.errors.name}
        />
        <div className="flex flex-wrap gap-3">
          <div className="w-40">
            <TextControl
              name="semester-start"
              label="Início"
              placeholder="dd/mm/aaaa"
              value={start}
              inputMode="numeric"
              onChange={(value) => {
                setStart(maskDateBR(value));
                validation.clear("startDate");
              }}
              error={validation.errors.startDate}
            />
          </div>
          <div className="w-40">
            <TextControl
              name="semester-end"
              label="Fim"
              placeholder="dd/mm/aaaa"
              value={end}
              inputMode="numeric"
              onChange={(value) => {
                setEnd(maskDateBR(value));
                validation.clear("endDate");
              }}
              error={validation.errors.endDate}
            />
          </div>
        </div>
        <Alert>Escolha um período futuro que não coincida com outro semestre.</Alert>
      </form>
    </TaskDialog>
  );
}
