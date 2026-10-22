"use client";

import {
  useState,
  type Dispatch,
  type FormEvent,
  type ReactElement,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, X } from "lucide-react";
import { studentFollowUpHref } from "./student-navigation";
import { interventionCreateSchema } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import { saoPauloDateOnly } from "@lazuli/domain";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { trpc } from "~/lib/trpc";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { InterventionFields, MotivatingOccurrenceFields } from "./intervention-fields";
import { QueryState } from "./shared";
import styles from "./intervention-form.module.css";

type Student = { id: string; name: string };
type Props = {
  student: Student;
  onClose: () => void;
  onCreated?: ((id: string) => void) | undefined;
  initialOccurrenceIds?: string[];
};
type Values = {
  title: string;
  responsibleId: string | null;
  performedOn: string;
  treatment: string;
};
type QueryModel<T> = {
  data: T | undefined;
  isPending: boolean;
  error: { message: string } | null;
  refetch: () => void;
};
type Model = {
  values: Values;
  setValues: Dispatch<SetStateAction<Values>>;
  occurrenceIds: string[];
  setOccurrenceIds: Dispatch<SetStateAction<string[]>>;
  occurrences: QueryModel<RouterOutputs["occurrences"]["forStudent"]>;
  options: QueryModel<RouterOutputs["interventions"]["formOptions"]>;
  validation: ReturnType<typeof useValidation>;
  save: ReturnType<typeof trpc.interventions.create.useMutation>;
};

export function StudentInterventionForm({
  student,
  onClose,
  onCreated,
  initialOccurrenceIds = [],
}: Props): ReactElement {
  const model = useInterventionModel({ student, onClose, onCreated, initialOccurrenceIds });
  return <InterventionDialog student={student} onClose={onClose} model={model} />;
}

function useInterventionModel({
  student,
  onClose,
  onCreated,
  initialOccurrenceIds = [],
}: Props): Model {
  const [values, setValues] = useState<Values>({
    title: "",
    responsibleId: null,
    performedOn: maskDateBR(saoPauloDateOnly(new Date()).split("-").toReversed().join("")),
    treatment: "",
  });
  const [occurrenceIds, setOccurrenceIds] = useState<string[]>(initialOccurrenceIds);
  const occurrences = trpc.occurrences.forStudent.useQuery({ studentId: student.id });
  const validation = useValidation();
  const options = trpc.interventions.formOptions.useQuery({ studentId: student.id });
  const utils = trpc.useUtils();
  const router = useRouter();
  const save = trpc.interventions.create.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.interventions.invalidate(), utils.occurrences.invalidate()]);
      onClose();
      if (onCreated) onCreated(result.id);
      else router.push(studentFollowUpHref(student.id, { kind: "intervention", id: result.id }));
    },
  });
  return {
    values,
    setValues,
    occurrenceIds,
    setOccurrenceIds,
    occurrences,
    options,
    validation,
    save,
  };
}

function InterventionDialog({
  student,
  onClose,
  model,
}: {
  student: Student;
  onClose: () => void;
  model: Model;
}): ReactElement {
  return (
    <TaskDialog
      title="Registrar intervenção"
      description={`${student.name} · Registre a tratativa realizada.`}
      firstField="intervention-title"
      formId="student-intervention-form"
      submitLabel="Registrar intervenção"
      size="extra-wide"
      actionSize="sm"
      submitIcon={<ClipboardList aria-hidden="true" />}
      cancelIcon={<X aria-hidden="true" />}
      pending={model.save.isPending}
      submitDisabled={model.options.isPending}
      onClose={onClose}
      bodyRef={model.validation.body}
      error={model.save.error?.message}
    >
      <form
        id="student-intervention-form"
        noValidate
        className={styles.layout}
        onSubmit={(event) => submitIntervention({ studentId: student.id, model, event })}
      >
        <InterventionSources model={model} />
        <InterventionTreatment model={model} />
      </form>
    </TaskDialog>
  );
}

function submitIntervention({
  studentId,
  model,
  event,
}: {
  studentId: string;
  model: Model;
  event: FormEvent<HTMLFormElement>;
}): void {
  event.preventDefault();
  if (model.save.isPending || model.options.isPending) return;
  const parsed = model.validation.validate(interventionCreateSchema, {
    ...model.values,
    responsibleId: model.values.responsibleId ?? model.options.data?.suggestedResponsible?.id ?? "",
    studentId,
    occurrenceIds: model.occurrenceIds,
    performedOn: parseDateBR(model.values.performedOn) ?? "",
  });
  if (parsed) model.save.mutate(parsed);
}

function InterventionSources({ model }: { model: Model }): ReactElement {
  const { occurrences, occurrenceIds, validation, save, setOccurrenceIds } = model;
  return (
    <aside className={styles.sources} aria-label="Selecionar ocorrências motivadoras">
      <QueryState
        pending={false}
        error={occurrences.error}
        retry={() => void occurrences.refetch()}
      />
      {(occurrences.isPending || occurrences.data) && (
        <MotivatingOccurrenceFields
          rows={occurrences.data ?? []}
          loading={occurrences.isPending}
          ids={occurrenceIds}
          error={validation.errors.occurrenceIds}
          onChange={(ids) => {
            setOccurrenceIds(ids);
            validation.clear("occurrenceIds");
            save.reset();
          }}
        />
      )}
    </aside>
  );
}

function InterventionTreatment({ model }: { model: Model }): ReactElement {
  const { values, setValues, options, validation, save } = model;
  const suggestion = options.data?.suggestedResponsible;
  const resolvedValues = { ...values, responsibleId: values.responsibleId ?? suggestion?.id ?? "" };
  return (
    <div className={styles.fields}>
      <InterventionFields
        values={resolvedValues}
        errors={validation.errors}
        staff={options.data?.staff ?? []}
        staffLoading={options.isPending}
        responsibleHint={
          values.responsibleId === null && suggestion
            ? `Professor de ${suggestion.classNames.join(", ")}. Você pode alterar.`
            : undefined
        }
        change={(name, value) => {
          setValues((current) => ({ ...current, [name]: value }));
          validation.clear(name);
          save.reset();
        }}
      />
      <QueryState pending={false} error={options.error} retry={() => void options.refetch()} />
    </div>
  );
}
