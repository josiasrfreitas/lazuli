"use client";
import type { ReactElement } from "react";
import {
  Alert,
  Field,
  FieldError,
  FormRow,
  InlineSkeleton,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { TeacherPicker } from "~/features/teachers/teacher-picker";
import { maskDateBR, maskTime24 } from "~/lib/masks";
import type { VisitFieldsProps, VisitMeeting } from "./visit-model";
import type { VisitOptions } from "./use-visit-form";
export function VisitKindField({ draft, change }: VisitFieldsProps): ReactElement {
  return (
    <>
      <SegmentedControl
        size="sm"
        aria-label="Tipo de aula"
        value={draft.kind}
        onValueChange={(value) => {
          if (value === "TRIAL" || value === "INTRODUCTION") change("kind", value);
        }}
      >
        <SegmentedControlItem value="TRIAL">Experimental</SegmentedControlItem>
        <SegmentedControlItem value="INTRODUCTION">Introdutória</SegmentedControlItem>
      </SegmentedControl>
      <p className="text-caption text-muted-foreground">
        {draft.kind === "TRIAL"
          ? "Participação em uma aula de turma, no horário e com o professor do encontro."
          : "Um encontro individual para conhecer o curso personalizado e seus materiais."}
      </p>
    </>
  );
}
export function VisitDateField({ draft, change, errors }: VisitFieldsProps): ReactElement {
  return (
    <div className="w-40">
      <TextControl
        name="date"
        label="Data da aula"
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        value={draft.date}
        onChange={(value) => change("date", maskDateBR(value))}
        error={errors.date}
      />
    </div>
  );
}
export function TrialVisitFields(
  props: VisitFieldsProps & { options: VisitOptions },
): ReactElement {
  const { draft, change, errors, options } = props;
  return (
    <>
      <SelectControl
        name="classId"
        label="Turma"
        value={draft.classId}
        choices={(options.classes.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
        onChange={(value) => change("classId", value)}
        error={errors["meeting.classId"]}
      />
      {options.classes.isError && <Alert variant="warning">{options.classes.error.message}</Alert>}
      {options.classes.data?.length === 0 && (
        <p className="text-caption text-muted-foreground">
          Nenhuma turma compatível com o interesse e os horários nesta data.
        </p>
      )}
      {draft.classId && <MeetingChoice {...props} />}
    </>
  );
}
function MeetingChoice({
  draft,
  change,
  errors,
  options,
}: VisitFieldsProps & { options: VisitOptions }): ReactElement {
  if (options.meetings.isError)
    return <Alert variant="destructive">{options.meetings.error.message}</Alert>;
  if (options.meetings.isPending) return <InlineSkeleton className="h-20 w-full" />;
  const meetings = options.meetings.data ?? [];
  if (meetings.length === 0)
    return (
      <Field>
        <p className="text-caption text-muted-foreground">
          A turma não tem aula nesta data. Escolha um dia do horário semanal.
        </p>
        <FieldError match={Boolean(errors.meeting)}>{errors.meeting}</FieldError>
      </Field>
    );
  if (meetings.length === 1) return <MeetingSummary meeting={meetings[0]!} />;
  return (
    <SelectControl
      name="meeting"
      label="Encontro da turma"
      value={draft.meetingKey}
      onChange={(value) => change("meetingKey", value)}
      choices={meetings.map((row) => ({
        value: row.slotId ?? row.sessionId ?? "",
        label: `${row.startTime}–${row.endTime} · ${row.substituteTeacherName ?? row.usualTeacherName ?? "Sem professor"}`,
      }))}
      error={errors.meeting}
    />
  );
}
function MeetingSummary({ meeting }: { meeting: VisitMeeting }): ReactElement {
  return (
    <div className="grid gap-1 rounded-md border border-border bg-muted p-3">
      <p className="text-caption text-muted-foreground">Encontro da turma</p>
      <p className="font-medium">
        {meeting.startTime}–{meeting.endTime}
      </p>
      <p className="text-caption">
        {meeting.substituteTeacherName ?? meeting.usualTeacherName ?? "Sem professor"}
      </p>
    </div>
  );
}
export function IntroductoryVisitFields(
  props: VisitFieldsProps & { date: string; online: boolean },
): ReactElement {
  return (
    <>
      <TeacherPicker
        date={props.date}
        value={props.draft.teacher}
        onChange={(value) => props.change("teacher", value)}
        error={props.errors["meeting.teacherId"] ?? null}
      />
      <VisitTimeFields {...props} />
      <p className="text-caption text-muted-foreground">
        {props.online ? "Encontro online" : "Encontro presencial"}. Conflitos do professor são
        verificados ao agendar.
      </p>
    </>
  );
}
export function VisitTimeFields({ draft, change, errors }: VisitFieldsProps): ReactElement {
  return (
    <FormRow columns={2}>
      <TextControl
        name="startTime"
        label="Início"
        placeholder="14:00"
        inputMode="numeric"
        value={draft.startTime}
        onChange={(value) => change("startTime", maskTime24(value))}
        error={errors["meeting.startTime"]}
      />
      <TextControl
        name="endTime"
        label="Término"
        placeholder="15:00"
        inputMode="numeric"
        value={draft.endTime}
        onChange={(value) => change("endTime", maskTime24(value))}
        error={errors["meeting.endTime"]}
      />
    </FormRow>
  );
}
