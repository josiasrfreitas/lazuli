"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, MessageSquareText, Pencil, UserCheck, X } from "lucide-react";
import { Alert, Button, Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { appointmentRecordSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { AppointmentContentField, AppointmentDurationField } from "./form-fields";
import { NarrativeField, useValidation } from "~/features/shared/task-form";
import { CoverageFields } from "./coverage-fields";
import { useAppointmentRefresh, type Appointment } from "./shared";
import styles from "./appointment-record-form.module.css";

export function AppointmentRecordForm({
  data,
  onClose,
  context,
  footerTarget,
  onPendingChange,
}: {
  data: Appointment;
  onClose: () => void;
  context?: ReactNode;
  footerTarget?: HTMLElement | null;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [opened] = useState(data);
  const snapshot = opened.snapshot;
  const correcting = snapshot.status !== "SCHEDULED";
  const [attended, setAttended] = useState(snapshot.status !== "NO_SHOW");
  const [content, setContent] = useState(snapshot.performedContent ?? "");
  const plannedMinutes =
    (new Date(`1970-01-01T${snapshot.endTime}:00Z`).getTime() -
      new Date(`1970-01-01T${snapshot.startTime}:00Z`).getTime()) /
    60000;
  const [minutes, setMinutes] = useState(String(snapshot.performedMinutes ?? plannedMinutes));
  const [coverages, setCoverages] = useState(
    snapshot.coverages
      .filter((row) => row.applicable)
      .map((row) => ({ attendanceId: row.attendanceId, minutes: row.minutes })),
  );
  const [notes, setNotes] = useState(snapshot.notes ?? "");
  const [reason, setReason] = useState("");
  const validation = useValidation();
  const refresh = useAppointmentRefresh();
  const save = trpc.appointments.record.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  useEffect(() => {
    document.getElementById("appointment-attended")?.focus();
  }, []);
  useEffect(() => {
    onPendingChange?.(save.isPending);
  }, [save.isPending, onPendingChange]);
  function submit() {
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
  const coverageFields =
    attended && snapshot.purpose === "MAKEUP" ? (
      <CoverageFields
        compact={Boolean(context)}
        sources={opened.absences}
        value={coverages}
        onChange={(value) => {
          setCoverages(value);
          validation.clear("coverages");
        }}
        error={validation.errors.coverages}
      />
    ) : null;
  const actions = (
    <>
      {(correcting || context || footerTarget) && (
        <Button
          size="sm"
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={onClose}
        >
          <X aria-hidden="true" />
          Cancelar edição
        </Button>
      )}
      <Button size="sm" type="submit" form="appointment-record" disabled={save.isPending}>
        <Check aria-hidden="true" />
        {save.isPending ? "Salvando…" : correcting ? "Salvar correção" : "Confirmar registro"}
      </Button>
    </>
  );
  return (
    <div ref={validation.body}>
      <form
        id="appointment-record"
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {!context && (
          <div>
            <h2 className="text-lg font-semibold">
              {correcting ? "Corrigir o registro" : "Registrar atendimento"}
            </h2>
            <p className="mt-1 text-caption text-muted-foreground">
              Confirme o comparecimento e descreva o que foi realizado.
            </p>
          </div>
        )}
        <fieldset disabled={save.isPending} className={context ? styles.workspace : styles.fields}>
          {context && (
            <aside className={styles.context} aria-label="Contexto do atendimento">
              {context}
            </aside>
          )}
          <div className={styles.fields}>
            {context && (
              <h3 className={styles.heading}>
                <Pencil aria-hidden="true" />
                {correcting ? "Corrigir registro" : "Registrar atendimento"}
              </h3>
            )}
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
                  value={attended ? "yes" : "no"}
                  onValueChange={(value) => {
                    if (value) setAttended(value === "yes");
                  }}
                >
                  <SegmentedControlItem id="appointment-attended" value="yes">
                    Compareceu
                  </SegmentedControlItem>
                  <SegmentedControlItem value="no">Não compareceu</SegmentedControlItem>
                </SegmentedControl>
              </Field>
              {attended && (
                <AppointmentDurationField
                  value={minutes}
                  onChange={(value) => {
                    setMinutes(value);
                    validation.clear("performedMinutes");
                  }}
                  error={validation.errors.performedMinutes}
                />
              )}
            </div>
            {!attended && (
              <Alert>
                O não comparecimento libera os minutos reservados para uma nova reposição.
              </Alert>
            )}
            <div className={context ? styles.narratives : styles.fields}>
              {attended && (
                <AppointmentContentField
                  value={content}
                  onChange={(value) => {
                    setContent(value);
                    validation.clear("performedContent");
                  }}
                  error={validation.errors.performedContent}
                />
              )}
              <NarrativeField
                name="record-notes"
                label="Observação · opcional"
                labelIcon={
                  <MessageSquareText
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground"
                  />
                }
                rows={context ? 3 : 2}
                placeholder="Devolutiva e próximos passos"
                value={notes}
                onChange={(value) => {
                  setNotes(value);
                  validation.clear("notes");
                }}
                error={validation.errors.notes}
              />
            </div>
            {coverageFields}
            {correcting && (
              <NarrativeField
                name="record-reason"
                label="Motivo da correção"
                labelIcon={<Pencil aria-hidden="true" className="size-3.5 text-muted-foreground" />}
                rows={2}
                placeholder="Explique a alteração; o registro anterior será preservado"
                value={reason}
                onChange={(value) => {
                  setReason(value);
                  validation.clear("reason");
                }}
                error={validation.errors.reason}
              />
            )}
            {save.error && <Alert variant="destructive">{save.error.message}</Alert>}
          </div>
        </fieldset>
        {footerTarget ? (
          createPortal(actions, footerTarget)
        ) : (
          <div className={styles.actions}>{actions}</div>
        )}
      </form>
    </div>
  );
}
