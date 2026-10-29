"use client";
import { useState, type FormEvent, type JSX as ReactJSX } from "react";
import { z, calendarDateSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { TextControl } from "~/features/classes/form-controls";
import { dateOnly, useOrganizationRefresh } from "~/features/class-organization/shared";
import type { OrganizationDialogProps as Props } from "./dialogs";
import styles from "./organization.module.css";

type PeriodFields = {
  name: string;
  start: string;
  end: string;
  errors: ReturnType<typeof useValidation>["errors"];
  submit: (event: FormEvent<HTMLFormElement>) => void;
  changeName: (value: string) => void;
  changeStart: (value: string) => void;
  changeEnd: (value: string) => void;
};
type PeriodModel = {
  fields: PeriodFields;
  body: ReturnType<typeof useValidation>["body"];
  pending: boolean;
  error: string | undefined;
};
const periodSchema = z.object({
  name: z.string().trim().min(1),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
});

export function PeriodForm(props: Props): ReactJSX.Element {
  const model = usePeriodModel(props);
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Período letivo"
      description="As datas delimitam a vigência das alocações deste período."
      formId="organization-period"
      firstField="period-name"
      submitLabel="Salvar período"
      pending={model.pending}
      onClose={props.onClose}
      error={model.error}
      bodyRef={model.body}
    >
      <PeriodFieldsForm fields={model.fields} />
    </TaskDialog>
  );
}

function usePeriodModel({ board, onClose, onFeedback }: Props): PeriodModel {
  const [name, setName] = useState(board.semester.name);
  const [start, setStart] = useState(formatDateOnlyBR(dateOnly(board.semester.startDate)));
  const [end, setEnd] = useState(formatDateOnlyBR(dateOnly(board.semester.endDate)));
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.updatePeriod.useMutation({
    onSuccess: async (result) => {
      await refresh();
      onFeedback(
        `Período atualizado.${result.affected ? ` ${result.affected} aulas ficaram fora do período; revise-as na Agenda.` : " Revise as vigências das propostas pendentes."}`,
      );
      onClose();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const values = validation.validate(periodSchema, {
      name,
      startDate: parseDateBR(start) ?? "",
      endDate: parseDateBR(end) ?? "",
    });
    if (values && !mutation.isPending) {
      mutation.mutate({
        ...values,
        semesterId: board.semester.id,
        previousStart: dateOnly(board.semester.startDate),
        previousEnd: dateOnly(board.semester.endDate),
      });
    }
  };
  return {
    body: validation.body,
    pending: mutation.isPending,
    error: mutation.error?.message,
    fields: {
      name,
      start,
      end,
      errors: validation.errors,
      submit,
      changeName: setName,
      changeStart: (value) => setStart(maskDateBR(value)),
      changeEnd: (value) => setEnd(maskDateBR(value)),
    },
  };
}

function PeriodFieldsForm({ fields }: { fields: PeriodFields }): ReactJSX.Element {
  return (
    <form className={styles.form} id="organization-period" noValidate onSubmit={fields.submit}>
      <TextControl
        name="period-name"
        label="Nome"
        placeholder="2027.1"
        value={fields.name}
        onChange={fields.changeName}
        error={fields.errors.name}
      />
      <div className={styles.formRow}>
        <TextControl
          name="period-start"
          label="Primeiro dia letivo"
          value={fields.start}
          onChange={fields.changeStart}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          error={fields.errors.startDate}
        />
        <TextControl
          name="period-end"
          label="Último dia letivo"
          value={fields.end}
          onChange={fields.changeEnd}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          error={fields.errors.endDate}
        />
      </div>
      <div className={styles.summary}>
        <span>Alocações confirmadas mantêm a vigência combinada.</span>
        <span>Férias e recessos são registrados como intervalos sem aula.</span>
      </div>
    </form>
  );
}
