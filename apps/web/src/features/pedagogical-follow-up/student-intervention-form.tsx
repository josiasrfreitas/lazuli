"use client";

import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { interventionCreateSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { InterventionFields } from "./intervention-form";
import { QueryState } from "./shared";

export function StudentInterventionForm({
  student,
  onClose,
}: {
  student: { id: string; name: string };
  onClose: () => void;
}): ReactElement {
  const [values, setValues] = useState({
    title: "",
    teacherId: "",
    objective: "",
    nextStep: "",
    dueOn: "",
  });
  const validation = useValidation();
  const teachers = trpc.interventions.teachers.useQuery();
  const utils = trpc.useUtils();
  const router = useRouter();
  const save = trpc.interventions.create.useMutation({
    onSuccess: async (result) => {
      await utils.interventions.invalidate();
      onClose();
      router.push(`/acompanhamento/intervencoes/${result.id}`);
    },
  });
  return (
    <TaskDialog
      title="Nova intervenção"
      description={`${student.name} · Combine o objetivo, o responsável e o próximo passo.`}
      firstField="intervention-title"
      formId="student-intervention-form"
      submitLabel="Criar intervenção"
      pending={save.isPending}
      onClose={onClose}
      bodyRef={validation.body}
      error={save.error?.message}
    >
      <form
        id="student-intervention-form"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(interventionCreateSchema, {
            ...values,
            studentId: student.id,
            occurrenceIds: [],
            dueOn: values.dueOn ? (parseDateBR(values.dueOn) ?? "") : null,
          });
          if (parsed) save.mutate(parsed);
        }}
      >
        <InterventionFields
          values={values}
          errors={validation.errors}
          teachers={teachers.data ?? []}
          change={(name, value) => {
            setValues((current) => ({ ...current, [name]: value }));
            validation.clear(name);
            save.reset();
          }}
        />
        <QueryState
          pending={teachers.isPending}
          error={teachers.error}
          retry={() => void teachers.refetch()}
        />
      </form>
    </TaskDialog>
  );
}
