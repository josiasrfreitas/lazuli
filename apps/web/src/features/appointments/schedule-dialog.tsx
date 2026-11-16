"use client";
import { AcademicExceptionDialog } from "./academic-exception-dialog";
import type { JSX as ReactJSX, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { ArrowRight, CalendarCheck, CalendarClock, CheckCircle2, X } from "lucide-react";
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
import { formatDateOnlyBR } from "~/lib/format";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { RecordState } from "~/features/class-records/shared";
import { PurposeField } from "./form-fields";
import { ClassMeetingStep, type ScheduleSelection } from "./class-meeting-step";
import { CoverageFields } from "./coverage-fields";
import { purposes, today } from "./shared";
import {
  useScheduleModel,
  type ScheduleDialogProps,
  type ScheduleModel,
} from "./schedule-dialog-model";

const DEFAULT_APPOINTMENT_MINUTES = 60;

function StudentSelector({ input, draft, data }: ScheduleModel): ReactJSX.Element | null {
  if (input.student || input.previous) return null;
  const { values, change, validation, update } = draft;
  return (
    <Field>
      <Label>Aluno</Label>
      <SearchSelect
        showSearchIcon
        name="appointment-student"
        placeholder="Buscar pelo nome"
        query={values.search}
        value={values.student}
        options={(data.results ?? []).map((row) => ({ id: row.id, label: row.fullName }))}
        onQueryChange={(search) => change("search", search)}
        onSelect={(student) => {
          update((current) => ({
            ...current,
            student,
            purpose: current.purpose === "PPT_COMPLEMENT" ? "MAKEUP" : current.purpose,
            teacherSelection: undefined,
            coverages: [],
          }));
          validation.clear("studentId");
        }}
        onClear={() =>
          update((current) => ({
            ...current,
            student: null,
            purpose: current.purpose === "PPT_COMPLEMENT" ? "MAKEUP" : current.purpose,
            teacherSelection: undefined,
            coverages: [],
          }))
        }
        loading={data.resultsFetching}
        invalid={Boolean(validation.errors.studentId)}
      />
      <FieldError match={Boolean(validation.errors.studentId)}>
        {validation.errors.studentId}
      </FieldError>
    </Field>
  );
}

function PurposeChoice({
  input,
  draft,
  data,
}: Pick<ScheduleModel, "input" | "draft" | "data">): ReactJSX.Element {
  if (input.previous)
    return (
      <p className="text-sm text-muted-foreground">
        {purposes[draft.values.purpose]} · O agendamento anterior será preservado como reagendado.
      </p>
    );
  return (
    <PurposeField
      allowPptComplement={Boolean(data.activePptEnrollment)}
      value={draft.values.purpose}
      onChange={(purpose) => {
        draft.change("purpose", purpose);
        draft.validation.clear("purpose");
        draft.validation.clear("coverages");
      }}
    />
  );
}

function KindChoice({ draft }: Pick<ScheduleModel, "draft">): ReactJSX.Element {
  return (
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
          value={draft.values.kind}
          onValueChange={(value) => {
            if (value !== "CLASS" && value !== "INDEPENDENT") return;
            draft.update((current) => ({
              ...current,
              kind: value,
              sessionId: "",
              startTime: "",
              endTime: "",
              selectionReady: false,
            }));
            draft.validation.clear("meeting");
          }}
        >
          <SegmentedControlItem id="appointment-kind" value="INDEPENDENT">
            Horário individual
          </SegmentedControlItem>
          <SegmentedControlItem value="CLASS">Participação em turma</SegmentedControlItem>
        </SegmentedControl>
      </Field>
    </div>
  );
}

function DetailsContext(model: ScheduleModel): ReactJSX.Element {
  return (
    <div className={styles.context}>
      <StudentSelector {...model} />
      <div className={styles.choices}>
        <PurposeChoice input={model.input} draft={model.draft} data={model.data} />
        <KindChoice draft={model.draft} />
      </div>
      {model.draft.values.student && (
        <RecordState
          pending={false}
          error={model.data.optionsError}
          retry={model.data.retryOptions}
        />
      )}
    </div>
  );
}

function MakeupContent(model: ScheduleModel): ReactJSX.Element {
  const { draft, data } = model;
  const student = draft.values.student;
  if (data.noMakeupSources)
    return (
      <div className="flex items-start gap-3 text-sm" role="status">
        <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="grid gap-1">
          <p className="font-medium">Nenhuma falta com saldo para repor</p>
          <p className="text-muted-foreground">Escolha outra finalidade para este atendimento.</p>
        </div>
      </div>
    );
  if (!student)
    return (
      <p className="text-sm text-muted-foreground">
        Selecione o aluno para consultar as faltas disponíveis.
      </p>
    );
  return (
    <CoverageFields
      key={student.id}
      compact
      sources={data.options?.absences ?? []}
      loading={data.optionsPending}
      value={draft.values.coverages}
      onChange={(coverages) => {
        draft.change("coverages", coverages);
        draft.validation.clear("coverages");
      }}
      error={draft.validation.errors.coverages}
    />
  );
}

function DetailsNotices(model: ScheduleModel): ReactJSX.Element {
  const { draft, data } = model;
  return (
    <>
      {draft.values.purpose === "MAKEUP" && (
        <div className={styles.coverage}>
          <MakeupContent {...model} />
        </div>
      )}
      {draft.values.purpose === "PPT_COMPLEMENT" && draft.values.student && data.optionsPending && (
        <div
          role="status"
          aria-label="Carregando matrícula PPT"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <InlineSkeleton className="h-4 w-24" />
          Consultando matrícula ativa…
        </div>
      )}
      {data.noCurrentEnrollment && (
        <p role="status" className="text-sm text-muted-foreground">
          Este aluno está sem matrícula vigente. Organize a matrícula antes de agendar um
          atendimento.
        </p>
      )}
      {!data.noCurrentEnrollment && data.noPptEnrollment && (
        <p role="status" className="text-sm text-muted-foreground">
          O aluno não possui matrícula PPT ativa. Escolha outra finalidade.
        </p>
      )}
      {data.enrollmentDateError && (
        <p role="alert" className="text-sm text-destructive">
          {data.enrollmentDateError}
        </p>
      )}
    </>
  );
}

function ReasonField({ draft }: Pick<ScheduleModel, "draft">): ReactJSX.Element {
  return (
    <NarrativeField
      rows={2}
      name="reschedule-reason"
      label="Motivo do reagendamento"
      value={draft.values.reason}
      onChange={(reason) => {
        draft.change("reason", reason);
        draft.validation.clear("reason");
      }}
      placeholder="O que mudou no combinado"
      error={draft.validation.errors.reason}
    />
  );
}

function DetailsNotes({ input, draft }: Pick<ScheduleModel, "input" | "draft">): ReactJSX.Element {
  return (
    <div className={styles.notes}>
      <div className={styles.noteFields} data-reschedule={Boolean(input.previous) || undefined}>
        <NarrativeField
          rows={2}
          name="plannedContent"
          label="O que trabalhar · opcional"
          value={draft.values.planned}
          onChange={(planned) => {
            draft.change("planned", planned);
            draft.validation.clear("plannedContent");
          }}
          placeholder="Conteúdo, objetivo ou referência para o professor"
          error={draft.validation.errors.plannedContent}
        />
        <NarrativeField
          rows={2}
          name="appointment-notes"
          label="Observação · opcional"
          value={draft.values.notes}
          onChange={(notes) => {
            draft.change("notes", notes);
            draft.validation.clear("notes");
          }}
          placeholder="Combinados com o aluno ou responsável"
          error={draft.validation.errors.notes}
        />
        {input.previous && <ReasonField draft={draft} />}
      </div>
    </div>
  );
}

function DetailsStep(model: ScheduleModel): ReactJSX.Element {
  return (
    <>
      <DetailsContext {...model} />
      <div className={styles.details}>
        <DetailsNotices {...model} />
        <DetailsNotes input={model.input} draft={model.draft} />
      </div>
    </>
  );
}

export function ScheduleNatureFields(model: ScheduleModel): ReactJSX.Element {
  return (
    <>
      <DetailsContext {...model} />
      <DetailsNotices {...model} />
    </>
  );
}

export function ScheduleNotesFields(model: ScheduleModel): ReactJSX.Element {
  return <DetailsNotes input={model.input} draft={model.draft} />;
}

type MeetingHandlers = {
  onTeacherChange: (value: SearchSelectOption | null) => void;
  onDateChange: (value: string) => void;
  onSelect: (value: ScheduleSelection) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
};

function meetingHandlers({ draft }: ScheduleModel): MeetingHandlers {
  const { update, validation } = draft;
  return {
    onTeacherChange: (teacherSelection) => {
      update((current) => ({
        ...current,
        teacherSelection,
        sessionId: "",
        startTime: "",
        endTime: "",
      }));
      validation.clear("meeting");
    },
    onDateChange: (date) => {
      update((current) => ({
        ...current,
        selectionReady: false,
        date: formatDateOnlyBR(date),
        sessionId: "",
      }));
      validation.clear("meeting");
    },
    onSelect: (value) => {
      update((current) => ({
        ...current,
        date: formatDateOnlyBR(value.date),
        startTime: value.startTime,
        endTime: value.endTime,
        sessionId: value.sessionId ?? "",
        format: value.format ?? current.format,
      }));
      validation.clear("meeting");
    },
    onStartChange: (startTime) => {
      update((current) => ({ ...current, selectionReady: false, startTime }));
    },
    onEndChange: (endTime) => {
      update((current) => ({ ...current, selectionReady: false, endTime }));
    },
  };
}

export function ScheduleMeetingStep({
  model,
  actions,
  renderSidebar,
}: {
  model: ScheduleModel;
  actions: ReactNode;
  renderSidebar?: ((fields: ReactNode) => ReactNode) | undefined;
}): ReactJSX.Element {
  const { input, draft, data } = model;
  const values = draft.values;
  const handlers = meetingHandlers(model);
  const durationMinutes =
    values.purpose === "MAKEUP"
      ? values.coverages.reduce((sum, row) => sum + row.minutes, 0)
      : DEFAULT_APPOINTMENT_MINUTES;
  return (
    <ClassMeetingStep
      actions={actions}
      renderSidebar={renderSidebar}
      durationMinutes={durationMinutes}
      kind={values.kind}
      studentId={values.student?.id ?? ""}
      previousId={input.previous?.id}
      teacher={data.teacher}
      onTeacherChange={handlers.onTeacherChange}
      date={data.parsedDate ?? today()}
      startTime={values.startTime}
      endTime={values.endTime}
      format={values.format}
      sessionId={values.sessionId}
      onDateChange={handlers.onDateChange}
      onSelect={handlers.onSelect}
      onStartChange={handlers.onStartChange}
      onEndChange={handlers.onEndChange}
      onFormatChange={(format) => draft.change("format", format)}
      onReadyChange={(selectionReady) => draft.change("selectionReady", selectionReady)}
      error={data.enrollmentDateError ?? draft.validation.errors.meeting}
    />
  );
}

function ScheduleForm({
  model,
  actions,
}: {
  model: ScheduleModel;
  actions: ReactNode;
}): ReactJSX.Element {
  const classStep = model.draft.values.step === "schedule";
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!classStep) return;
    const frame = requestAnimationFrame(() => {
      form.current
        ?.querySelector<HTMLElement>("input:not([disabled]), button:not([disabled])")
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [classStep]);
  return (
    <form
      key={model.draft.values.step}
      ref={form}
      id="appointment-schedule"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        model.submission.submit();
      }}
      className={classStep ? styles.scheduleLayout : styles.layout}
    >
      {classStep ? (
        <ScheduleMeetingStep model={model} actions={actions} />
      ) : (
        <DetailsStep {...model} />
      )}
      {!classStep && <div className="flex flex-wrap justify-end gap-3">{actions}</div>}
    </form>
  );
}

function firstField({ input }: ScheduleModel): string {
  if (input.previous) return "appointment-kind";
  if (input.student) return "appointment-purpose";
  return "appointment-student";
}

function submitLabel(model: ScheduleModel): string {
  if (model.draft.values.step === "details") return "Selecionar horário";
  return model.input.previous ? "Confirmar reagendamento" : "Agendar atendimento";
}

function dialogDescription(model: ScheduleModel): string {
  const student = model.draft.values.student?.label;
  if (model.draft.values.step === "schedule") return student ?? "Selecione um horário";
  return (student ?? "Selecione o aluno para agendar.") + " · Etapa 1 de 2: atendimento";
}

function dialogBack(model: ScheduleModel): (() => void) | undefined {
  if (model.draft.values.step !== "schedule") return undefined;
  return () => {
    model.draft.change("step", "details");
    requestAnimationFrame(() => document.querySelector<HTMLElement>("#appointment-kind")?.focus());
  };
}

function dialogSubmitDisabled(model: ScheduleModel): boolean {
  if (model.data.unavailable) return true;
  if (model.draft.values.step !== "schedule") return false;
  return !model.draft.values.selectionReady || Boolean(model.data.enrollmentDateError);
}

function dialogSubmitIcon(classStep: boolean): ReactJSX.Element {
  if (classStep) return <CalendarCheck aria-hidden="true" />;
  return <ArrowRight aria-hidden="true" />;
}

function ScheduleDialogFrame(model: ScheduleModel): ReactJSX.Element {
  const { input, draft, submission } = model;
  const classStep = draft.values.step === "schedule";
  return (
    <TaskDialog
      size={classStep ? "extra-wide" : "wide"}
      layout={classStep ? "appointment-calendar" : "appointment"}
      scheduleFrame
      compactHeader={classStep}
      {...(classStep ? { bodyLayout: "calendar" as const } : {})}
      title={input.previous ? "Reagendar atendimento" : "Agendar atendimento"}
      description={dialogDescription(model)}
      formId="appointment-schedule"
      firstField={firstField(model)}
      pending={submission.pending}
      onClose={input.onClose}
      onBack={dialogBack(model)}
      actionSize="sm"
      cancelIcon={<X aria-hidden="true" />}
      submitIcon={dialogSubmitIcon(classStep)}
      submitDisabled={dialogSubmitDisabled(model)}
      submitLabel={submitLabel(model)}
      error={submission.error}
      bodyRef={draft.validation.body}
    >
      {(actions) => <ScheduleForm model={model} actions={actions} />}
    </TaskDialog>
  );
}

export function ScheduleAppointmentDialog(input: ScheduleDialogProps): ReactJSX.Element {
  const model = useScheduleModel(input);
  return (
    <>
      <ScheduleDialogFrame {...model} />
      <AcademicExceptionDialog model={model} />
    </>
  );
}
