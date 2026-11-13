"use client";

import type { ReactElement } from "react";
import { Check, X } from "lucide-react";
import { TaskDialog } from "~/features/shared/task-form";
import { OccurrenceCalendar } from "./occurrence-form-calendar";
import { OccurrenceFields } from "./occurrence-form-fields";
import {
  useOccurrenceFormModel,
  type OccurrenceFormProps,
  type OccurrenceFormModel,
} from "./occurrence-form-model";
import styles from "./occurrence-form.module.css";

export function OccurrenceForm(props: OccurrenceFormProps): ReactElement {
  const model = useOccurrenceFormModel(props);
  return <OccurrenceDialog model={model} onClose={props.onClose} />;
}

function OccurrenceDialog({
  model,
  onClose,
}: {
  model: OccurrenceFormModel;
  onClose: () => void;
}): ReactElement {
  return (
    <TaskDialog
      title="Registrar ocorrência"
      description={
        model.student ? model.student.name : "Escolha a aula e registre o que aconteceu."
      }
      size={model.outside ? "default" : "extra-wide"}
      {...(model.outside ? {} : { layout: "occurrence" as const })}
      compactHeader
      onClose={onClose}
      pending={model.save.isPending}
      firstField={model.outside ? "occurredOn" : "classSessionId"}
      formId="occurrence-form"
      submitLabel="Registrar ocorrência"
      submitDisabled={!model.canSubmit}
      actionSize="sm"
      submitIcon={<Check aria-hidden="true" className="size-4" />}
      cancelIcon={<X aria-hidden="true" className="size-4" />}
      bodyRef={model.validation.body}
      error={model.save.error?.message}
    >
      <form id="occurrence-form" noValidate onSubmit={model.submit}>
        <fieldset
          disabled={model.save.isPending}
          className={model.outside ? styles.outsideLayout : styles.layout}
        >
          <legend className="sr-only">Registro de ocorrência</legend>
          <OccurrenceCalendar model={model} />
          {!model.outside && <OccurrenceFields model={model} />}
        </fieldset>
      </form>
    </TaskDialog>
  );
}
