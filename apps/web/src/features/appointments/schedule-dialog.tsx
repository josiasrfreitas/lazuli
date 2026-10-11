"use client";
import { useState } from "react";
import {
  appointmentScheduleSchema,
  appointmentRescheduleSchema,
  type AppointmentSnapshot,
  type MakeupCoverageInput,
} from "@lazuli/validators";
import {
  Alert,
  Field,
  FieldError,
  FormSection,
  Label,
  SearchSelect,
  SegmentedControl,
  SegmentedControlItem,
  type SearchSelectOption,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR } from "~/lib/format";
import { SelectControl } from "~/features/classes/form-controls";
import { TeacherPicker } from "~/features/teachers/teacher-picker";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
import { RecordState } from "~/features/class-records/shared";
import { PurposeField, MeetingDateField, MeetingTimeFields } from "./form-fields";
import { CoverageFields } from "./coverage-fields";
import { purposes, today, useAppointmentRefresh, type Absence } from "./shared";

export function ScheduleAppointmentDialog({
  student: initialStudent,
  source,
  previous,
  onClose,
}: {
  student?: { id: string; name: string };
  source?: Absence;
  previous?: AppointmentSnapshot;
  onClose: () => void;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [student, setStudent] = useState<SearchSelectOption | null>(
    initialStudent
      ? { id: initialStudent.id, label: initialStudent.name }
      : previous
        ? { id: previous.student.id, label: previous.student.name }
        : null,
  );
  const [search, setSearch] = useState("");
  const [purpose, setPurpose] = useState<AppointmentSnapshot["purpose"]>(
    previous?.purpose ?? "MAKEUP",
  );
  const [kind, setKind] = useState<"CLASS" | "INDEPENDENT">(
    previous?.targetClassSessionId ? "CLASS" : "INDEPENDENT",
  );
  const [date, setDate] = useState(formatDateOnlyBR(today()));
  const [sessionId, setSessionId] = useState("");
  const [enrollmentId, setEnrollmentId] = useState(previous?.enrollmentId ?? "");
  const [teacher, setTeacher] = useState<SearchSelectOption | null>(
    previous?.teacher ? { id: previous.teacher.id, label: previous.teacher.name } : null,
  );
  const [startTime, setStart] = useState(previous?.startTime ?? "");
  const [endTime, setEnd] = useState(previous?.endTime ?? "");
  const [format, setFormat] = useState<"IN_PERSON" | "ONLINE">(previous?.format ?? "IN_PERSON");
  const [planned, setPlanned] = useState(previous?.plannedContent ?? "");
  const [notes, setNotes] = useState(previous?.notes ?? "");
  const [reason, setReason] = useState("");
  const [coverages, setCoverages] = useState<MakeupCoverageInput[]>(
    source
      ? [{ attendanceId: source.id, minutes: source.available }]
      : (previous?.coverages.map((row) => ({
          attendanceId: row.attendanceId,
          minutes: row.minutes,
        })) ?? []),
  );
  const validation = useValidation();
  const results = trpc.students.search.useQuery(
    { query: search },
    { enabled: !initialStudent && !previous && search.length >= 2 },
  );
  const options = trpc.appointments.student.useQuery(
    { studentId: student?.id ?? "", ...(previous ? { excludeAppointmentId: previous.id } : {}) },
    { enabled: Boolean(student), retry: false },
  );
  const parsedDate = parseDateBR(date);
  const destinations = trpc.appointments.destinations.useQuery(
    { date: parsedDate ?? today() },
    { enabled: kind === "CLASS" && Boolean(parsedDate), retry: false },
  );
  const refresh = useAppointmentRefresh();
  const saved = async () => {
    await refresh();
    onClose();
  };
  const schedule = trpc.appointments.schedule.useMutation({ onSuccess: saved });
  const reschedule = trpc.appointments.reschedule.useMutation({ onSuccess: saved });
  const pending = schedule.isPending || reschedule.isPending;
  function submit() {
    const values = validation.validate(appointmentScheduleSchema, {
      id,
      studentId: student?.id ?? "",
      purpose,
      enrollmentId: enrollmentId || null,
      plannedContent: planned,
      notes,
      coverages: purpose === "MAKEUP" ? coverages : [],
      meeting:
        kind === "CLASS"
          ? { kind, sessionId }
          : {
              kind,
              teacherId: teacher?.id ?? "",
              date: parsedDate ?? "",
              startTime,
              endTime,
              format,
            },
    });
    if (!values || pending) return;
    if (previous) {
      const replacement = validation.validate(appointmentRescheduleSchema, {
        id: previous.id,
        expectedVersion: previous.version,
        reason,
        replacement: values,
      });
      if (replacement) reschedule.mutate(replacement);
    } else schedule.mutate(values);
  }
  const availableEnrollments =
    options.data?.enrollments.filter(
      (row) =>
        purpose !== "PPT_COMPLEMENT" ||
        (row.scheduleType === "PERSONALIZED" &&
          (!parsedDate ||
            (row.entryDate <= parsedDate && (!row.exitDate || row.exitDate > parsedDate)))),
    ) ?? [];
  return (
    <TaskDialog
      title={previous ? "Reagendar atendimento" : "Agendar atendimento"}
      description={student?.label ?? "Um encontro com propósito e acompanhamento."}
      formId="appointment-schedule"
      firstField={
        previous
          ? "appointment-date"
          : initialStudent
            ? "appointment-purpose"
            : "appointment-student"
      }
      pending={pending}
      onClose={onClose}
      submitLabel={previous ? "Confirmar reagendamento" : "Agendar atendimento"}
      error={schedule.error?.message ?? reschedule.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="appointment-schedule"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="grid gap-5 pt-4"
      >
        {!initialStudent && !previous && (
          <Field>
            <Label>Aluno</Label>
            <SearchSelect
              name="appointment-student"
              placeholder="Buscar pelo nome"
              query={search}
              value={student}
              options={(results.data ?? []).map((row) => ({ id: row.id, label: row.fullName }))}
              onQueryChange={setSearch}
              onSelect={(next) => {
                setStudent(next);
                validation.clear("studentId");
                setCoverages([]);
                setEnrollmentId("");
              }}
              onClear={() => {
                setStudent(null);
                setCoverages([]);
                setEnrollmentId("");
              }}
              loading={results.isFetching}
              invalid={Boolean(validation.errors.studentId)}
            />
            <FieldError match={Boolean(validation.errors.studentId)}>
              {validation.errors.studentId}
            </FieldError>
          </Field>
        )}
        {previous ? (
          <p className="text-caption text-muted-foreground">
            {purposes[purpose]} · O agendamento anterior será preservado como reagendado.
          </p>
        ) : (
          <PurposeField
            value={purpose}
            onChange={(value) => {
              setPurpose(value);
              setEnrollmentId("");
              validation.clear("purpose");
              validation.clear("coverages");
            }}
          />
        )}
        {student && (
          <RecordState
            pending={options.isPending}
            error={options.error}
            retry={() => void options.refetch()}
          />
        )}
        {purpose === "MAKEUP" && options.data && (
          <CoverageFields
            sources={options.data.absences}
            value={coverages}
            onChange={(value) => {
              setCoverages(value);
              validation.clear("coverages");
            }}
            error={validation.errors.coverages}
          />
        )}
        {purpose === "PPT_COMPLEMENT" && (
          <SelectControl
            name="enrollmentId"
            label="Matrícula PPT"
            value={enrollmentId}
            onChange={(value) => {
              setEnrollmentId(value);
              validation.clear("enrollmentId");
            }}
            choices={availableEnrollments.map((row) => ({ value: row.id, label: row.className }))}
            error={validation.errors.enrollmentId}
          />
        )}
        <FormSection title="Encontro" className="border-t border-border pt-4">
          <SegmentedControl
            size="sm"
            aria-label="Local do atendimento"
            value={kind}
            onValueChange={(value) => {
              if (value === "CLASS" || value === "INDEPENDENT") setKind(value);
            }}
          >
            <SegmentedControlItem value="INDEPENDENT">Horário individual</SegmentedControlItem>
            <SegmentedControlItem value="CLASS">Participação em turma</SegmentedControlItem>
          </SegmentedControl>
          <MeetingDateField
            value={date}
            onChange={(value) => {
              setDate(value);
              setSessionId("");
              validation.clear("meeting");
            }}
            error={validation.errors["meeting.date"]}
          />
          {kind === "CLASS" ? (
            <>
              <RecordState
                pending={destinations.isPending}
                error={destinations.error}
                retry={() => void destinations.refetch()}
              />
              <SelectControl
                name="appointment-session"
                label="Aula de destino"
                value={sessionId}
                onChange={(value) => {
                  setSessionId(value);
                  validation.clear("meeting");
                }}
                choices={(destinations.data ?? []).map((row) => ({
                  value: row.id,
                  label: `${row.startTime}–${row.endTime} · ${row.name} · ${row.teacher?.name ?? ""}`,
                }))}
                error={validation.errors.meeting}
              />
              {destinations.data?.length === 0 && (
                <p className="text-caption text-muted-foreground">
                  Nenhuma aula disponível nesta data. Escolha outra data ou um horário individual.
                </p>
              )}
            </>
          ) : (
            <>
              <TeacherPicker
                date={parsedDate ?? today()}
                value={teacher}
                onChange={(value) => {
                  setTeacher(value);
                  validation.clear("meeting");
                }}
                error={validation.errors["meeting.teacherId"]}
              />
              <MeetingTimeFields
                start={startTime}
                end={endTime}
                onStart={(value) => {
                  setStart(value);
                  validation.clear("meeting");
                }}
                onEnd={(value) => {
                  setEnd(value);
                  validation.clear("meeting");
                }}
                errors={validation.errors}
              />
              <SegmentedControl
                size="sm"
                aria-label="Formato"
                value={format}
                onValueChange={(value) => {
                  if (value === "IN_PERSON" || value === "ONLINE") setFormat(value);
                }}
              >
                <SegmentedControlItem value="IN_PERSON">Presencial</SegmentedControlItem>
                <SegmentedControlItem value="ONLINE">Online</SegmentedControlItem>
              </SegmentedControl>
            </>
          )}
          {validation.errors.meeting && (
            <Alert variant="destructive">{validation.errors.meeting}</Alert>
          )}
        </FormSection>
        <details
          open={Boolean(validation.errors.plannedContent || validation.errors.notes) || undefined}
        >
          <summary className="cursor-pointer text-caption text-interactive">
            Orientações e observações · opcional
          </summary>
          <div className="mt-3 grid gap-3">
            <NarrativeField
              name="plannedContent"
              label="O que trabalhar · opcional"
              value={planned}
              onChange={(value) => {
                setPlanned(value);
                validation.clear("plannedContent");
              }}
              placeholder="Conteúdo, objetivo ou referência para o professor"
              error={validation.errors.plannedContent}
            />
            <NarrativeField
              name="appointment-notes"
              label="Observação · opcional"
              value={notes}
              onChange={(value) => {
                setNotes(value);
                validation.clear("notes");
              }}
              placeholder="Combinados com o aluno ou responsável"
              error={validation.errors.notes}
            />
          </div>
        </details>
        {previous && (
          <NarrativeField
            name="reschedule-reason"
            label="Motivo do reagendamento"
            value={reason}
            onChange={(value) => {
              setReason(value);
              validation.clear("reason");
            }}
            placeholder="O que mudou no combinado"
            error={validation.errors.reason}
          />
        )}
      </form>
    </TaskDialog>
  );
}
