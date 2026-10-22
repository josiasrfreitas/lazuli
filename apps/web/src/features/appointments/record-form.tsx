"use client";
import type { Dispatch, JSX as ReactJSX, ReactNode, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MessageSquareText, Pencil, UserCheck, X } from "lucide-react";
import { Alert, Button, Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { appointmentRecordSchema, type MakeupCoverageInput } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { AppointmentContentField, AppointmentDurationField } from "./form-fields";
import { NarrativeField, useValidation } from "~/features/shared/task-form";
import { CoverageFields } from "./coverage-fields";
import { useAppointmentRefresh, type Appointment } from "./shared";
import styles from "./appointment-record-form.module.css";

const CONTEXT_NOTE_ROWS = 3;
const MILLISECONDS_PER_MINUTE = 60_000;
type Props = {
  data: Appointment;
  onClose: () => void;
  context?: ReactNode;
  footerTarget?: HTMLElement | null;
  onPendingChange?: ((pending: boolean) => void) | undefined;
};
type RecordModel = {
  opened: Appointment;
  snapshot: Appointment["snapshot"];
  correcting: boolean;
  attended: boolean;
  setAttended: Dispatch<SetStateAction<boolean>>;
  content: string;
  setContent: Dispatch<SetStateAction<string>>;
  minutes: string;
  setMinutes: Dispatch<SetStateAction<string>>;
  coverages: MakeupCoverageInput[];
  setCoverages: Dispatch<SetStateAction<MakeupCoverageInput[]>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
  reason: string;
  setReason: Dispatch<SetStateAction<string>>;
  validation: ReturnType<typeof useValidation>;
};
type RecordSave = { pending: boolean; error: string | undefined; submit: () => void };

function useRecordModel(data: Appointment): RecordModel {
  const [opened] = useState(data);
  const snapshot = opened.snapshot;
  const correcting = snapshot.status !== "SCHEDULED";
  const [attended, setAttended] = useState(snapshot.status !== "NO_SHOW");
  const [content, setContent] = useState(snapshot.performedContent ?? "");
  const plannedMinutes =
    (new Date("1970-01-01T" + snapshot.endTime + ":00Z").getTime() -
      new Date("1970-01-01T" + snapshot.startTime + ":00Z").getTime()) /
    MILLISECONDS_PER_MINUTE;
  const [minutes, setMinutes] = useState(String(snapshot.performedMinutes ?? plannedMinutes));
  const [coverages, setCoverages] = useState<MakeupCoverageInput[]>(
    snapshot.coverages
      .filter((row) => row.applicable)
      .map((row) => ({
        attendanceId: row.attendanceId,
        minutes: row.minutes,
      })),
  );
  const [notes, setNotes] = useState(snapshot.notes ?? "");
  const [reason, setReason] = useState("");
  const validation = useValidation();
  return {
    opened,
    snapshot,
    correcting,
    attended,
    setAttended,
    content,
    setContent,
    minutes,
    setMinutes,
    coverages,
    setCoverages,
    notes,
    setNotes,
    reason,
    setReason,
    validation,
  };
}

function useRecordSave(
  model: RecordModel,
  { onClose, onPendingChange }: Pick<Props, "onClose" | "onPendingChange">,
): RecordSave {
  const refresh = useAppointmentRefresh();
  const save = trpc.appointments.record.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  useEffect(() => {
    onPendingChange?.(save.isPending);
  }, [save.isPending, onPendingChange]);
  function submit(): void {
    const {
      snapshot,
      correcting,
      attended,
      content,
      minutes,
      notes,
      reason,
      coverages,
      validation,
    } = model;
    const parsed = validation.validate(
      appointmentRecordSchema.refine((value) => !correcting || Boolean(value.reason.trim()), {
        path: ["reason"],
        message: "Explique o motivo da correção.",
      }),
      {
        id: snapshot.id,
        expectedVersion: snapshot.version,
        attended,
        performedContent: attended ? content : "",
        performedMinutes: attended ? Number(minutes) : null,
        notes,
        reason,
        coverages: attended ? coverages : [],
      },
    );
    if (parsed && !save.isPending) save.mutate(parsed);
  }
  return { pending: save.isPending, error: save.error?.message, submit };
}

function RecordAttendance({ model }: { model: RecordModel }): ReactJSX.Element {
  return (
    <div className={styles.attendance}>
      <Field>
        <Label id="appointment-attendance-label">
          <span className="inline-flex items-center gap-1.5">
            <UserCheck aria-hidden="true" className="size-3.5 text-muted-foreground" />
            Comparecimento
          </span>
        </Label>
        <SegmentedControl
          size="sm"
          aria-labelledby="appointment-attendance-label"
          value={model.attended ? "yes" : "no"}
          onValueChange={(value) => {
            if (value) model.setAttended(value === "yes");
          }}
        >
          <SegmentedControlItem id="appointment-attended" value="yes">
            Compareceu
          </SegmentedControlItem>
          <SegmentedControlItem value="no">Não compareceu</SegmentedControlItem>
        </SegmentedControl>
      </Field>
      {model.attended && (
        <AppointmentDurationField
          value={model.minutes}
          onChange={(value) => {
            model.setMinutes(value);
            model.validation.clear("performedMinutes");
          }}
          error={model.validation.errors.performedMinutes}
        />
      )}
    </div>
  );
}

function RecordNarratives({
  model,
  context,
}: {
  model: RecordModel;
  context?: ReactNode;
}): ReactJSX.Element {
  return (
    <div className={context ? styles.narratives : styles.fields}>
      {model.attended && (
        <AppointmentContentField
          value={model.content}
          onChange={(value) => {
            model.setContent(value);
            model.validation.clear("performedContent");
          }}
          error={model.validation.errors.performedContent}
        />
      )}
      <NarrativeField
        name="record-notes"
        label="Observação · opcional"
        labelIcon={
          <MessageSquareText aria-hidden="true" className="size-3.5 text-muted-foreground" />
        }
        rows={context ? CONTEXT_NOTE_ROWS : 2}
        placeholder="Devolutiva e próximos passos"
        value={model.notes}
        onChange={(value) => {
          model.setNotes(value);
          model.validation.clear("notes");
        }}
        error={model.validation.errors.notes}
      />
    </div>
  );
}

function RecordCoverage({
  model,
  compact,
}: {
  model: RecordModel;
  compact: boolean;
}): ReactJSX.Element | null {
  if (!model.attended || model.snapshot.purpose !== "MAKEUP") return null;
  return (
    <CoverageFields
      compact={compact}
      sources={model.opened.absences}
      value={model.coverages}
      onChange={(value) => {
        model.setCoverages(value);
        model.validation.clear("coverages");
      }}
      error={model.validation.errors.coverages}
    />
  );
}

function RecordCorrection({ model }: { model: RecordModel }): ReactJSX.Element | null {
  if (!model.correcting) return null;
  return (
    <NarrativeField
      name="record-reason"
      label="Motivo da correção"
      labelIcon={<Pencil aria-hidden="true" className="size-3.5 text-muted-foreground" />}
      rows={2}
      placeholder="Explique a alteração; o registro anterior será preservado"
      value={model.reason}
      onChange={(value) => {
        model.setReason(value);
        model.validation.clear("reason");
      }}
      error={model.validation.errors.reason}
    />
  );
}

function RecordFieldset({
  model,
  context,
  save,
}: {
  model: RecordModel;
  context?: ReactNode;
  save: RecordSave;
}): ReactJSX.Element {
  return (
    <fieldset disabled={save.pending} className={context ? styles.workspace : styles.fields}>
      {context && (
        <aside className={styles.context} aria-label="Contexto do atendimento">
          {context}
        </aside>
      )}
      <div className={styles.fields}>
        {context && (
          <h3 className={styles.heading}>
            <Pencil aria-hidden="true" />
            {model.correcting ? "Corrigir registro" : "Registrar atendimento"}
          </h3>
        )}
        <RecordAttendance model={model} />
        {!model.attended && (
          <Alert>O não comparecimento libera os minutos reservados para uma nova reposição.</Alert>
        )}
        <RecordNarratives model={model} context={context} />
        <RecordCoverage model={model} compact={Boolean(context)} />
        <RecordCorrection model={model} />
        {save.error && <Alert variant="destructive">{save.error}</Alert>}
      </div>
    </fieldset>
  );
}

function RecordActions({
  correcting,
  context,
  footerTarget,
  save,
  onClose,
}: {
  correcting: boolean;
  context?: ReactNode;
  footerTarget?: HTMLElement | null | undefined;
  save: RecordSave;
  onClose: () => void;
}): ReactJSX.Element {
  let submitLabel = "Confirmar registro";
  if (correcting) submitLabel = "Salvar correção";
  if (save.pending) submitLabel = "Salvando…";
  const actions = (
    <>
      {(correcting || context || footerTarget) && (
        <Button
          size="sm"
          type="button"
          variant="secondary"
          disabled={save.pending}
          onClick={onClose}
        >
          <X aria-hidden="true" />
          Cancelar edição
        </Button>
      )}
      <Button size="sm" type="submit" form="appointment-record" disabled={save.pending}>
        <Check aria-hidden="true" />
        {submitLabel}
      </Button>
    </>
  );
  return footerTarget ? (
    createPortal(actions, footerTarget)
  ) : (
    <div className={styles.actions}>{actions}</div>
  );
}

export function AppointmentRecordForm({
  data,
  onClose,
  context,
  footerTarget,
  onPendingChange,
}: Props): ReactJSX.Element {
  const model = useRecordModel(data);
  const save = useRecordSave(model, { onClose, onPendingChange });
  useEffect(() => {
    document.querySelector<HTMLElement>("#appointment-attended")?.focus();
  }, []);
  return (
    <div ref={model.validation.body}>
      <form
        id="appointment-record"
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save.submit();
        }}
      >
        {!context && (
          <div>
            <h2 className="text-lg font-semibold">
              {model.correcting ? "Corrigir o registro" : "Registrar atendimento"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirme o comparecimento e descreva o que foi realizado.
            </p>
          </div>
        )}
        <RecordFieldset model={model} context={context} save={save} />
        <RecordActions
          correcting={model.correcting}
          context={context}
          footerTarget={footerTarget}
          save={save}
          onClose={onClose}
        />
      </form>
    </div>
  );
}
