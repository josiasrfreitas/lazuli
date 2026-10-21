"use client";
import type { JSX as ReactJSX } from "react";
import { ArrowRight, CalendarCheck, CalendarClock, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import {
  appointmentScheduleSchema,
  appointmentRescheduleSchema,
  type AppointmentSnapshot,
  type MakeupCoverageInput,
} from "@lazuli/validators";
import {
  Field,
  FieldError,
  InlineSkeleton,
  Label,
  SearchSelect,
  SegmentedControl,
  SegmentedControlItem,
  type SearchSelectOption,
} from "@lazuli/ui";
import styles from "./schedule-dialog.module.css";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR } from "~/lib/format";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
import { RecordState } from "~/features/class-records/shared";
import { PurposeField } from "./form-fields";
import { ClassMeetingStep, type ScheduleSelection } from "./class-meeting-step";
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
}): ReactJSX.Element {
  const [id] = useState(() => crypto.randomUUID());
  const [student, setStudent] = useState<SearchSelectOption | null>(
    initialStudent
      ? { id: initialStudent.id, label: initialStudent.name }
      : previous
        ? { id: previous.student.id, label: previous.student.name }
        : null,
  );
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"details" | "schedule">("details");
  const [purpose, setPurpose] = useState<AppointmentSnapshot["purpose"]>(
    previous?.purpose ?? "MAKEUP",
  );
  const [kind, setKind] = useState<"CLASS" | "INDEPENDENT">(
    previous?.targetClassSessionId ? "CLASS" : "INDEPENDENT",
  );
  const [date, setDate] = useState(formatDateOnlyBR(previous?.date ?? today()));
  const [sessionId, setSessionId] = useState(previous?.targetClassSessionId ?? "");
  const [teacherSelection, setTeacher] = useState<SearchSelectOption | null | undefined>(
    previous
      ? previous.teacher
        ? { id: previous.teacher.id, label: previous.teacher.name }
        : null
      : undefined,
  );
  const [startTime, setStart] = useState(previous?.startTime ?? "");
  const [endTime, setEnd] = useState(previous?.endTime ?? "");
  const [format, setFormat] = useState<"IN_PERSON" | "ONLINE">(previous?.format ?? "IN_PERSON");
  const [selectionReady, setSelectionReady] = useState(false);
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
  const defaultTeacher = options.data?.defaultTeacher;
  const teacher =
    teacherSelection === undefined
      ? defaultTeacher
        ? { id: defaultTeacher.id, label: defaultTeacher.name }
        : null
      : teacherSelection;
  const parsedDate = parseDateBR(date);
  const refresh = useAppointmentRefresh();
  const saved = async () => {
    await refresh();
    onClose();
  };
  const schedule = trpc.appointments.schedule.useMutation({ onSuccess: saved });
  const reschedule = trpc.appointments.reschedule.useMutation({ onSuccess: saved });
  const pending = schedule.isPending || reschedule.isPending;
  function submit() {
    if (pending || unavailable) return;
    const draft = {
      id,
      studentId: student?.id ?? "",
      purpose,
      enrollmentId:
        purpose === "PPT_COMPLEMENT"
          ? (activePptEnrollment?.id ?? null)
          : (previous?.enrollmentId ?? null),
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
    };
    if (step === "details") {
      if (
        !validation.validateFields(appointmentScheduleSchema, {
          values: draft,
          fields: ["studentId", "purpose", "enrollmentId", "plannedContent", "notes", "coverages"],
        })
      )
        return;
      if (
        previous &&
        !validation.validate(appointmentRescheduleSchema.pick({ reason: true }), { reason })
      )
        return;
      setSelectionReady(false);
      setStep("schedule");
      return;
    }
    if (enrollmentDateError || !selectionReady) return;
    const values = validation.validate(appointmentScheduleSchema, draft);
    if (!values) return;
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
  const currentDate = today();
  const activePptEnrollment = options.data?.enrollments.find(
    (row) =>
      row.scheduleType === "PERSONALIZED" &&
      row.entryDate <= currentDate &&
      (!row.exitDate || row.exitDate > currentDate),
  );
  const hasMakeupSources = Boolean(
    options.data?.absences.some(
      (row) => row.available > 0 || coverages.some((coverage) => coverage.attendanceId === row.id),
    ),
  );
  const noMakeupSources =
    purpose === "MAKEUP" && Boolean(student) && options.isSuccess && !hasMakeupSources;
  const noPptEnrollment =
    purpose === "PPT_COMPLEMENT" && Boolean(student) && options.isSuccess && !activePptEnrollment;
  const noCurrentEnrollment = options.isSuccess && !options.data.hasCurrentEnrollment;
  const unavailable =
    Boolean(student) &&
    (options.isPending ||
      options.isError ||
      noCurrentEnrollment ||
      noMakeupSources ||
      noPptEnrollment);
  const classStep = step === "schedule";
  const enrollmentDateError =
    classStep &&
    purpose === "PPT_COMPLEMENT" &&
    activePptEnrollment &&
    parsedDate &&
    (activePptEnrollment.entryDate > parsedDate ||
      (activePptEnrollment.exitDate && activePptEnrollment.exitDate <= parsedDate))
      ? "A matrícula PPT atual não está vigente neste dia. Escolha outra data."
      : undefined;
  return (
    <TaskDialog
      size={classStep ? "extra-wide" : "wide"}
      contentClassName={classStep ? `${styles.dialog} ${styles.calendarDialog}` : styles.dialog}
      compactHeader={classStep}
      bodyClassName={classStep ? styles.calendarBody : undefined}
      title={previous ? "Reagendar atendimento" : "Agendar atendimento"}
      description={
        classStep
          ? (student?.label ?? "Selecione um horário")
          : `${student?.label ?? "Selecione o aluno para agendar."} · Etapa 1 de 2: atendimento`
      }
      formId="appointment-schedule"
      firstField={
        previous
          ? "appointment-kind"
          : initialStudent
            ? "appointment-purpose"
            : "appointment-student"
      }
      pending={pending}
      onClose={onClose}
      onBack={
        classStep
          ? () => {
              setStep("details");
              requestAnimationFrame(() => document.getElementById("appointment-kind")?.focus());
            }
          : undefined
      }
      actionSize="sm"
      cancelIcon={<X aria-hidden="true" />}
      submitIcon={
        classStep ? <CalendarCheck aria-hidden="true" /> : <ArrowRight aria-hidden="true" />
      }
      submitDisabled={
        unavailable || (classStep && (!selectionReady || Boolean(enrollmentDateError)))
      }
      submitLabel={
        classStep
          ? previous
            ? "Confirmar reagendamento"
            : "Agendar atendimento"
          : "Selecionar horário"
      }
      error={schedule.error?.message ?? reschedule.error?.message}
      bodyRef={validation.body}
    >
      {(actions) => (
        <form
          id="appointment-schedule"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className={classStep ? styles.scheduleLayout : styles.layout}
        >
          {classStep ? (
            <ClassMeetingStep
              actions={actions}
              durationMinutes={
                purpose === "MAKEUP" ? coverages.reduce((sum, row) => sum + row.minutes, 0) : 60
              }
              kind={kind}
              studentId={student?.id ?? ""}
              previousId={previous?.id}
              teacher={teacher}
              onTeacherChange={(value) => {
                setTeacher(value);
                setSessionId("");
                setStart("");
                setEnd("");
                validation.clear("meeting");
              }}
              date={parsedDate ?? today()}
              startTime={startTime}
              endTime={endTime}
              format={format}
              sessionId={sessionId}
              onDateChange={(value) => {
                setSelectionReady(false);
                setDate(formatDateOnlyBR(value));
                setSessionId("");
                validation.clear("meeting");
              }}
              onSelect={(value: ScheduleSelection) => {
                setDate(formatDateOnlyBR(value.date));
                setStart(value.startTime);
                setEnd(value.endTime);
                setSessionId(value.sessionId ?? "");
                if (value.format) setFormat(value.format);
                validation.clear("meeting");
              }}
              onStartChange={(value) => {
                setSelectionReady(false);
                setStart(value);
              }}
              onEndChange={(value) => {
                setSelectionReady(false);
                setEnd(value);
              }}
              onFormatChange={setFormat}
              onReadyChange={setSelectionReady}
              error={enrollmentDateError ?? validation.errors.meeting}
            />
          ) : (
            <>
              <div className={styles.context}>
                {!initialStudent && !previous && (
                  <Field>
                    <Label>Aluno</Label>
                    <SearchSelect
                      showSearchIcon
                      name="appointment-student"
                      placeholder="Buscar pelo nome"
                      query={search}
                      value={student}
                      options={(results.data ?? []).map((row) => ({
                        id: row.id,
                        label: row.fullName,
                      }))}
                      onQueryChange={setSearch}
                      onSelect={(next) => {
                        setStudent(next);
                        setTeacher(undefined);
                        validation.clear("studentId");
                        setCoverages([]);
                      }}
                      onClear={() => {
                        setStudent(null);
                        setTeacher(undefined);
                        setCoverages([]);
                      }}
                      loading={results.isFetching}
                      invalid={Boolean(validation.errors.studentId)}
                    />
                    <FieldError match={Boolean(validation.errors.studentId)}>
                      {validation.errors.studentId}
                    </FieldError>
                  </Field>
                )}
                <div className={styles.choices}>
                  {previous ? (
                    <p className="text-caption text-muted-foreground">
                      {purposes[purpose]} · O agendamento anterior será preservado como reagendado.
                    </p>
                  ) : (
                    <PurposeField
                      value={purpose}
                      onChange={(value) => {
                        setPurpose(value);
                        validation.clear("purpose");
                        validation.clear("coverages");
                      }}
                    />
                  )}
                  <div className={styles.choiceGroup}>
                    <Field>
                      <Label id="appointment-kind-label">
                        <span className="inline-flex items-center gap-2">
                          <CalendarClock className="size-4" aria-hidden="true" />
                          Tipo de encontro
                        </span>
                      </Label>
                      <SegmentedControl
                        size="sm"
                        wrap
                        aria-labelledby="appointment-kind-label"
                        value={kind}
                        onValueChange={(value) => {
                          if (value === "CLASS" || value === "INDEPENDENT") {
                            setKind(value);
                            setSessionId("");
                            setStart("");
                            setEnd("");
                            setSelectionReady(false);
                            validation.clear("meeting");
                          }
                        }}
                      >
                        <SegmentedControlItem id="appointment-kind" value="INDEPENDENT">
                          Horário individual
                        </SegmentedControlItem>
                        <SegmentedControlItem value="CLASS">
                          Participação em turma
                        </SegmentedControlItem>
                      </SegmentedControl>
                    </Field>
                  </div>
                </div>
                {student && (
                  <RecordState
                    pending={false}
                    error={options.error}
                    retry={() => void options.refetch()}
                  />
                )}
              </div>
              <div className={styles.details}>
                {purpose === "MAKEUP" && (
                  <div className={styles.coverage}>
                    {noMakeupSources ? (
                      <div className="flex items-start gap-3 text-caption" role="status">
                        <CheckCircle2
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="grid gap-1">
                          <p className="font-medium">Nenhuma falta com saldo para repor</p>
                          <p className="text-muted-foreground">
                            Escolha outra finalidade para este atendimento.
                          </p>
                        </div>
                      </div>
                    ) : student ? (
                      <CoverageFields
                        key={student.id}
                        compact
                        sources={options.data?.absences ?? []}
                        loading={options.isPending}
                        value={coverages}
                        onChange={(value) => {
                          setCoverages(value);
                          validation.clear("coverages");
                        }}
                        error={validation.errors.coverages}
                      />
                    ) : (
                      <p className="text-caption text-muted-foreground">
                        Selecione o aluno para consultar as faltas disponíveis.
                      </p>
                    )}
                  </div>
                )}
                {purpose === "PPT_COMPLEMENT" && student && options.isPending && (
                  <div
                    role="status"
                    aria-label="Carregando matrícula PPT"
                    className="flex items-center gap-2 text-caption text-muted-foreground"
                  >
                    <InlineSkeleton className="h-4 w-24" />
                    Consultando matrícula ativa…
                  </div>
                )}
                {noCurrentEnrollment && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Este aluno está sem matrícula vigente. Organize a matrícula antes de agendar um
                    atendimento.
                  </p>
                )}
                {!noCurrentEnrollment && noPptEnrollment && (
                  <p role="status" className="text-caption text-muted-foreground">
                    O aluno não possui matrícula PPT ativa. Escolha outra finalidade.
                  </p>
                )}
                {enrollmentDateError && (
                  <p role="alert" className="text-caption text-destructive">
                    {enrollmentDateError}
                  </p>
                )}

                <div className={styles.notes}>
                  <div
                    className={styles.noteFields}
                    data-reschedule={Boolean(previous) || undefined}
                  >
                    <NarrativeField
                      rows={2}
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
                      rows={2}
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
                    {previous && (
                      <NarrativeField
                        rows={2}
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
                  </div>
                </div>
              </div>
            </>
          )}
          {!classStep && <div className="flex flex-wrap justify-end gap-3">{actions}</div>}
        </form>
      )}
    </TaskDialog>
  );
}
