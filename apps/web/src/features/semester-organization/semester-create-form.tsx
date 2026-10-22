"use client";

import { useState, type FormEventHandler, type JSX as ReactJSX } from "react";
import { createSemesterInputSchema } from "@lazuli/validators";
import { Alert } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { TextControl } from "~/features/classes/form-controls";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { useOrganizationRefresh } from "./shared";

type State = {
  name: string;
  start: string;
  end: string;
  errors: ReturnType<typeof useValidation>["errors"];
  bodyRef: ReturnType<typeof useValidation>["body"];
  pending: boolean;
  error: string | undefined;
  submit: FormEventHandler<HTMLFormElement>;
  onName: (value: string) => void;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
};

export function SemesterForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}): ReactJSX.Element {
  const state = useSemesterFormState(onClose, onSaved);
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Novo semestre"
      description="O período acadêmico organiza as aulas e as futuras matrículas."
      formId="semester-create"
      firstField="semester-name"
      submitLabel="Criar semestre"
      onClose={onClose}
      pending={state.pending}
      error={state.error}
      bodyRef={state.bodyRef}
    >
      <SemesterFields state={state} />
    </TaskDialog>
  );
}

function useSemesterFormState(onClose: () => void, onSaved: (id: string) => void): State {
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
  const submit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const values = validation.validate(createSemesterInputSchema, {
      name,
      startDate: parseDateBR(start) ?? "",
      endDate: parseDateBR(end) ?? "",
    });
    if (values && !mutation.isPending) mutation.mutate(values);
  };
  return {
    name,
    start,
    end,
    errors: validation.errors,
    bodyRef: validation.body,
    pending: mutation.isPending,
    error: mutation.error?.message,
    submit,
    onName: (value) => {
      setName(value);
      validation.clear("name");
    },
    onStart: (value) => {
      setStart(maskDateBR(value));
      validation.clear("startDate");
    },
    onEnd: (value) => {
      setEnd(maskDateBR(value));
      validation.clear("endDate");
    },
  };
}

function SemesterFields({ state }: { state: State }): ReactJSX.Element {
  return (
    <form id="semester-create" noValidate className="grid gap-4 pt-4" onSubmit={state.submit}>
      <TextControl
        name="semester-name"
        label="Nome"
        placeholder="2027.1"
        value={state.name}
        onChange={state.onName}
        error={state.errors.name}
      />
      <SemesterDateFields state={state} />
      <Alert>Escolha um período futuro que não coincida com outro semestre.</Alert>
    </form>
  );
}

function SemesterDateFields({ state }: { state: State }): ReactJSX.Element {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-40">
        <TextControl
          name="semester-start"
          label="Início"
          placeholder="dd/mm/aaaa"
          value={state.start}
          inputMode="numeric"
          onChange={state.onStart}
          error={state.errors.startDate}
        />
      </div>
      <div className="w-40">
        <TextControl
          name="semester-end"
          label="Fim"
          placeholder="dd/mm/aaaa"
          value={state.end}
          inputMode="numeric"
          onChange={state.onEnd}
          error={state.errors.endDate}
        />
      </div>
    </div>
  );
}
