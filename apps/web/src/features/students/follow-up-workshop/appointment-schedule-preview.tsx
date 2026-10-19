import { useState, type ReactElement } from "react";
import { Alert } from "@lazuli/ui";
import type { AppointmentSnapshot } from "@lazuli/validators";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import {
  PurposeField,
  MeetingDateField,
  MeetingTimeFields,
} from "~/features/appointments/form-fields";
import { purposes } from "~/features/appointments/shared";
import { parseDateBR } from "~/lib/masks";
import type { PreviewAppointment } from "./appointment-preview";

type Props = { onClose: () => void; onSave: (row: PreviewAppointment) => void };
export function AppointmentSchedulePreview(props: Props): ReactElement {
  return (
    <TaskDialog
      title="Agendar atendimento"
      description="Simulação · o atendimento será adicionado apenas a este exemplo."
      firstField="appointment-purpose"
      formId="workshop-schedule"
      submitLabel="Agendar atendimento"
      pending={false}
      onClose={props.onClose}
    >
      <ScheduleForm {...props} />
    </TaskDialog>
  );
}
export function ScheduleForm({ onSave }: Props): ReactElement {
  const [purpose, setPurpose] = useState<AppointmentSnapshot["purpose"]>("REINFORCEMENT");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  function submit(): void {
    const parsed = parseDateBR(date);
    if (
      !parsed ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) ||
      end <= start ||
      !note.trim()
    ) {
      setError("Informe uma data válida, horários de início e fim e o motivo do atendimento.");
      return;
    }
    onSave(makeAppointment({ date: parsed, start, end, purpose, note }));
  }
  return (
    <form
      id="workshop-schedule"
      noValidate
      className="grid gap-4 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error && <Alert variant="destructive">{error}</Alert>}
      <PurposeField value={purpose} onChange={setPurpose} />
      <div className="flex flex-wrap items-end gap-3">
        <MeetingDateField value={date} onChange={setDate} />
        <MeetingTimeFields start={start} end={end} onStart={setStart} onEnd={setEnd} errors={{}} />
      </div>
      <NarrativeField
        name="plannedContent"
        label="Motivo do atendimento"
        placeholder="O que precisa ser trabalhado neste encontro"
        value={note}
        onChange={setNote}
      />
    </form>
  );
}

type ScheduleDraft = {
  date: string;
  start: string;
  end: string;
  purpose: AppointmentSnapshot["purpose"];
  note: string;
};
function makeAppointment({ date, start, end, purpose, note }: ScheduleDraft): PreviewAppointment {
  const calendarDate = new Date(`${date}T12:00:00Z`);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" }).format(
    calendarDate,
  );
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(calendarDate)
    .replace(".", "");
  return {
    id: crypto.randomUUID(),
    day: `${day} ${month}`,
    time: `${start}–${end}`,
    purpose: purposes[purpose],
    teacher: "Professor a definir",
    note: note.trim(),
    status: "SCHEDULED",
  };
}
