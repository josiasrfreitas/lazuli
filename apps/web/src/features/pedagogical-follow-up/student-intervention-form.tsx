"use client";

import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, X } from "lucide-react";
import { studentFollowUpHref } from "./student-navigation";
import { interventionCreateSchema } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { trpc } from "~/lib/trpc";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { InterventionFields, MotivatingOccurrenceFields } from "./intervention-fields";
import { QueryState } from "./shared";
import styles from "./intervention-form.module.css";

export function StudentInterventionForm({
  student,
  onClose,
  onCreated,
  initialOccurrenceIds = [],
}: {
  student: { id: string; name: string };
  onClose: () => void;
  onCreated?: (id: string) => void;
  initialOccurrenceIds?: string[];
}): ReactElement {
  const [values, setValues] = useState({
    title: "",
    responsibleId: null as string | null,
    performedOn: maskDateBR(saoPauloDateOnly(new Date()).split("-").toReversed().join("")),
    treatment: "",
  });
  const [occurrenceIds, setOccurrenceIds] = useState<string[]>(initialOccurrenceIds);
  const occurrences = trpc.occurrences.forStudent.useQuery({ studentId: student.id });
  const validation = useValidation();
  const options = trpc.interventions.formOptions.useQuery({ studentId: student.id });
  const suggestion = options.data?.suggestedResponsible;
  const resolvedValues = {
    ...values,
    responsibleId: values.responsibleId ?? suggestion?.id ?? "",
  };
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
      pending={save.isPending}
      submitDisabled={options.isPending}
      onClose={onClose}
      bodyRef={validation.body}
      error={save.error?.message}
    >
      <form
        id="student-intervention-form"
        noValidate
        className={styles.layout}
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending || options.isPending) return;
          const parsed = validation.validate(interventionCreateSchema, {
            ...resolvedValues,
            studentId: student.id,
            occurrenceIds,
            performedOn: parseDateBR(values.performedOn) ?? "",
          });
          if (parsed) save.mutate(parsed);
        }}
      >
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
      </form>
    </TaskDialog>
  );
}
