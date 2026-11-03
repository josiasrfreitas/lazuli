"use client";
import { useState, type FormEvent, type JSX as ReactJSX } from "react";
import { z, calendarDateSchema, closedDayReasonSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { TextControl } from "~/features/classes/form-controls";
import { dateOnly, useOrganizationRefresh } from "~/features/class-organization/shared";
import type { OrganizationDialogProps as Props } from "./dialogs";
import styles from "./organization.module.css";

type ClosureFields = {
  from: string;
  through: string;
  reason: string;
  errors: ReturnType<typeof useValidation>["errors"];
  submit: (event: FormEvent<HTMLFormElement>) => void;
  changeFrom: (value: string) => void;
  changeThrough: (value: string) => void;
  changeReason: (value: string) => void;
};
type ClosureModel = {
  fields: ClosureFields;
  body: ReturnType<typeof useValidation>["body"];
  pending: boolean;
  error: string | undefined;
};
const closureSchema = z
  .object({
    from: calendarDateSchema,
    through: calendarDateSchema,
    reason: closedDayReasonSchema,
  })
  .refine((input) => input.from <= input.through, {
    path: ["through"],
    message: "O fim deve ser posterior ao início.",
  });

export function ClosureForm(props: Props & { initialDate: string }): ReactJSX.Element {
  const model = useClosureModel(props);
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Dia ou intervalo sem aula"
      description="Feriado local, férias, recesso ou exceção da escola."
      formId="organization-closure"
      firstField="closure-reason"
      submitLabel="Salvar no calendário"
      pending={model.pending}
      onClose={props.onClose}
      error={model.error}
      bodyRef={model.body}
    >
      <ClosureFieldsForm fields={model.fields} />
    </TaskDialog>
  );
}

function useClosureModel({
  board,
  initialDate,
  onClose,
  onFeedback,
}: Props & { initialDate: string }): ClosureModel {
  const [from, setFrom] = useState(formatDateOnlyBR(initialDate));
  const [through, setThrough] = useState(formatDateOnlyBR(initialDate));
  const existing = board.closedDays.find((item) => dateOnly(item.date) === initialDate);
  const [reason, setReason] = useState(existing?.reason ?? "");
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.closeRange.useMutation({
    onSuccess: async (result) => {
      await refresh();
      onFeedback(
        `${result.added} datas incluídas.${result.affected ? ` ${result.affected} aulas já existentes precisam ser revisadas na Agenda.` : " Novas aulas respeitarão este intervalo."}`,
      );
      onClose();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const values = validation.validate(closureSchema, {
      from: parseDateBR(from) ?? "",
      through: parseDateBR(through) ?? "",
      reason,
    });
    if (values && !mutation.isPending) mutation.mutate(values);
  };
  const fields: ClosureFields = {
    from,
    through,
    reason,
    errors: validation.errors,
    submit,
    changeFrom: (value) => {
      setFrom(maskDateBR(value));
      if (through === from) setThrough(maskDateBR(value));
    },
    changeThrough: (value) => setThrough(maskDateBR(value)),
    changeReason: setReason,
  };
  return {
    fields,
    body: validation.body,
    pending: mutation.isPending,
    error: mutation.error?.message,
  };
}

function ClosureFieldsForm({ fields }: { fields: ClosureFields }): ReactJSX.Element {
  return (
    <form className={styles.form} id="organization-closure" noValidate onSubmit={fields.submit}>
      <TextControl
        name="closure-reason"
        label="Motivo"
        placeholder="Ex.: feriado municipal de Lagarto"
        value={fields.reason}
        onChange={fields.changeReason}
        error={fields.errors.reason}
      />
      <div className={styles.formRow}>
        <TextControl
          name="closure-from"
          label="De"
          placeholder="dd/mm/aaaa"
          value={fields.from}
          onChange={fields.changeFrom}
          inputMode="numeric"
          error={fields.errors.from}
        />
        <TextControl
          name="closure-through"
          label="Até · inclusive"
          placeholder="dd/mm/aaaa"
          value={fields.through}
          onChange={fields.changeThrough}
          inputMode="numeric"
          error={fields.errors.through}
        />
      </div>
      <p className={styles.small}>
        Use a mesma data para um único dia. Datas já cadastradas serão preservadas. Aulas já geradas
        precisam ser revisadas na Agenda.
      </p>
    </form>
  );
}
