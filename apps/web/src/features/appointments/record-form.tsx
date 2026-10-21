"use client";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";
import { Check, MessageSquareText, Pencil, UserCheck, X } from "lucide-react";
import { Alert, Button, Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { AppointmentContentField, AppointmentDurationField } from "./form-fields";
import { NarrativeField } from "~/features/shared/task-form";
import { CoverageFields } from "./coverage-fields";
import { useAppointmentRecord, type RecordFormProps, type RecordModel } from "./record-model";
import styles from "./appointment-record-form.module.css";
const EXPANDED_NOTE_ROWS = 3;
type FormView = { props: RecordFormProps; model: RecordModel };

export function AppointmentRecordForm(props: RecordFormProps): ReactElement {
  const model = useAppointmentRecord(props);
  const actions = <RecordActions props={props} model={model} />;
  return (
    <div ref={model.validation.body}>
      <form
        id="appointment-record"
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          model.submit();
        }}
      >
        {!props.context && <RecordFormHeading model={model} />}
        <RecordFields props={props} model={model} />
        {props.footerTarget ? (
          createPortal(actions, props.footerTarget)
        ) : (
          <div className={styles.actions}>{actions}</div>
        )}
      </form>
    </div>
  );
}
function RecordFormHeading({ model }: { model: RecordModel }): ReactElement {
  return (
    <div>
      <h2 className="text-lg font-semibold">
        {model.correcting ? "Corrigir o registro" : "Registrar atendimento"}
      </h2>
      <p className="mt-1 text-caption text-muted-foreground">
        Confirme o comparecimento e descreva o que foi realizado.
      </p>
    </div>
  );
}
function RecordFields({ props, model }: FormView): ReactElement {
  return (
    <fieldset
      disabled={model.save.isPending}
      className={props.context ? styles.workspace : styles.fields}
    >
      {props.context && (
        <aside className={styles.context} aria-label="Contexto do atendimento">
          {props.context}
        </aside>
      )}
      <div className={styles.fields}>
        {props.context && (
          <h3 className={styles.heading}>
            <Pencil aria-hidden="true" />
            {model.correcting ? "Corrigir registro" : "Registrar atendimento"}
          </h3>
        )}
        <RecordAttendance model={model} />
        <RecordNarratives props={props} model={model} />
        <RecordCoverages props={props} model={model} />
        {model.correcting && <RecordReason model={model} />}
        {model.save.error && <Alert variant="destructive">{model.save.error.message}</Alert>}
      </div>
    </fieldset>
  );
}
function RecordAttendance({ model }: { model: RecordModel }): ReactElement {
  return (
    <>
      <div className={styles.attendance}>
        <AttendanceChoice model={model} />
        {model.draft.attended && (
          <AppointmentDurationField
            value={model.draft.minutes}
            onChange={(value) => model.edit({ minutes: value }, "performedMinutes")}
            error={model.validation.errors.performedMinutes}
          />
        )}
      </div>
      {!model.draft.attended && (
        <Alert>O não comparecimento libera os minutos reservados para uma nova reposição.</Alert>
      )}
    </>
  );
}
function AttendanceChoice({ model }: { model: RecordModel }): ReactElement {
  return (
    <Field>
      <Label id="appointment-attendance-label">
        <span className="inline-flex items-center gap-1.5">
          <UserCheck aria-hidden="true" className="size-3.5 text-muted-foreground" /> Comparecimento
        </span>
      </Label>
      <SegmentedControl
        size="sm"
        aria-labelledby="appointment-attendance-label"
        value={model.draft.attended ? "yes" : "no"}
        onValueChange={(value) => {
          if (value) model.edit({ attended: value === "yes" });
        }}
      >
        <SegmentedControlItem id="appointment-attended" value="yes">
          Compareceu
        </SegmentedControlItem>
        <SegmentedControlItem value="no">Não compareceu</SegmentedControlItem>
      </SegmentedControl>
    </Field>
  );
}
function RecordNarratives({ props, model }: FormView): ReactElement {
  return (
    <div className={props.context ? styles.narratives : styles.fields}>
      {model.draft.attended && (
        <AppointmentContentField
          value={model.draft.content}
          onChange={(value) => model.edit({ content: value }, "performedContent")}
          error={model.validation.errors.performedContent}
        />
      )}
      <NarrativeField
        name="record-notes"
        label="Observação · opcional"
        labelIcon={
          <MessageSquareText aria-hidden="true" className="size-3.5 text-muted-foreground" />
        }
        rows={props.context ? EXPANDED_NOTE_ROWS : 2}
        placeholder="Devolutiva e próximos passos"
        value={model.draft.notes}
        onChange={(value) => model.edit({ notes: value }, "notes")}
        error={model.validation.errors.notes}
      />
    </div>
  );
}
function RecordCoverages({ props, model }: FormView): ReactElement | null {
  if (!model.draft.attended || model.opened.snapshot.purpose !== "MAKEUP") return null;
  return (
    <CoverageFields
      compact={Boolean(props.context)}
      sources={model.opened.absences}
      value={model.draft.coverages}
      onChange={(value) => model.edit({ coverages: value }, "coverages")}
      error={model.validation.errors.coverages}
    />
  );
}
function RecordReason({ model }: { model: RecordModel }): ReactElement {
  return (
    <NarrativeField
      name="record-reason"
      label="Motivo da correção"
      labelIcon={<Pencil aria-hidden="true" className="size-3.5 text-muted-foreground" />}
      rows={2}
      placeholder="Explique a alteração; o registro anterior será preservado"
      value={model.draft.reason}
      onChange={(value) => model.edit({ reason: value }, "reason")}
      error={model.validation.errors.reason}
    />
  );
}
function RecordActions({ props, model }: FormView): ReactElement {
  return (
    <>
      {(model.correcting || props.context || props.footerTarget) && (
        <Button
          size="sm"
          type="button"
          variant="secondary"
          disabled={model.save.isPending}
          onClick={props.onClose}
        >
          <X aria-hidden="true" /> Cancelar edição
        </Button>
      )}
      <Button size="sm" type="submit" form="appointment-record" disabled={model.save.isPending}>
        <Check aria-hidden="true" />
        {saveLabel(model)}
      </Button>
    </>
  );
}
function saveLabel(model: RecordModel): string {
  if (model.save.isPending) return "Salvando…";
  return model.correcting ? "Salvar correção" : "Confirmar registro";
}
