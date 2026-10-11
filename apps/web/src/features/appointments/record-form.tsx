"use client";
import { useEffect, useState } from "react";
import { Alert, Button, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { appointmentRecordSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { AppointmentWorkFields } from "./form-fields";
import { NarrativeField, useValidation } from "~/features/shared/task-form";
import { CoverageFields } from "./coverage-fields";
import { useAppointmentRefresh, type Appointment } from "./shared";

export function AppointmentRecordForm({
  data,
  onClose,
}: {
  data: Appointment;
  onClose: () => void;
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
  return (
    <div ref={validation.body}>
      <form
        id="appointment-record"
        className="grid gap-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div>
          <h2 className="text-lg font-semibold">
            {correcting ? "Corrigir o registro" : "Registrar atendimento"}
          </h2>
          <p className="mt-1 text-caption text-muted-foreground">
            Confirme o comparecimento e descreva o que foi realizado.
          </p>
        </div>
        <SegmentedControl
          aria-label="Comparecimento"
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
        {attended ? (
          <>
            <AppointmentWorkFields
              minutes={minutes}
              content={content}
              onMinutes={(value) => {
                setMinutes(value);
                validation.clear("performedMinutes");
              }}
              onContent={(value) => {
                setContent(value);
                validation.clear("performedContent");
              }}
              errors={validation.errors}
            />
            {snapshot.purpose === "MAKEUP" && (
              <CoverageFields
                sources={opened.absences}
                value={coverages}
                onChange={(value) => {
                  setCoverages(value);
                  validation.clear("coverages");
                }}
                error={validation.errors.coverages}
              />
            )}
          </>
        ) : (
          <Alert>O não comparecimento libera os minutos reservados para uma nova reposição.</Alert>
        )}
        <NarrativeField
          name="record-notes"
          label="Observação · opcional"
          placeholder="Devolutiva e próximos passos"
          value={notes}
          onChange={(value) => {
            setNotes(value);
            validation.clear("notes");
          }}
          error={validation.errors.notes}
        />
        {correcting && (
          <NarrativeField
            name="record-reason"
            label="Motivo da correção"
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
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {correcting && (
            <Button variant="secondary" disabled={save.isPending} onClick={onClose}>
              Voltar
            </Button>
          )}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : correcting ? "Salvar correção" : "Confirmar registro"}
          </Button>
        </div>
      </form>
    </div>
  );
}
