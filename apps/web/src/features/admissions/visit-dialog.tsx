"use client";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  FormRow,
  SegmentedControl,
  SegmentedControlItem,
  type SearchSelectOption,
} from "@lazuli/ui";
import { entryVisitScheduleSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { maskDateBR, maskTime24, parseDateBR } from "~/lib/masks";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { TeacherPicker } from "~/features/teachers/teacher-picker";
import { dateLabel, type Candidate } from "./labels";

export function VisitDialog({
  candidate,
  previousVisitId,
  onClose,
}: {
  candidate: Candidate;
  previousVisitId?: string;
  onClose: () => void;
}): ReactElement {
  const previous = candidate.visits.find((visit) => visit.id === previousVisitId);
  const [id] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<"TRIAL" | "INTRODUCTION">(
    previous?.kind ?? (candidate.scheduleType === "PERSONALIZED" ? "INTRODUCTION" : "TRIAL"),
  );
  const [date, setDate] = useState(dateLabel(previous?.date ?? candidate.today));
  const [classId, setClassId] = useState(previous?.classId ?? "");
  const [meetingKey, setMeetingKey] = useState(
    previous?.scheduleSlotId ?? previous?.classSessionId ?? "",
  );
  const [teacher, setTeacher] = useState<SearchSelectOption | null>(
    previous?.teacherId
      ? { id: previous.teacherId, label: previous.teacherName ?? "Professor" }
      : null,
  );
  const [startTime, setStart] = useState(previous?.startTime ?? "");
  const [endTime, setEnd] = useState(previous?.endTime ?? "");
  const [notes, setNotes] = useState(previous?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const popup = useRef<HTMLDivElement>(null);
  const parsedDate = parseDateBR(date);
  const classes = trpc.admissions.matches.useQuery(
    { id: candidate.id, date: parsedDate ?? candidate.today },
    { enabled: kind === "TRIAL" && Boolean(parsedDate), retry: false },
  );
  const meetings = trpc.admissions.meetings.useQuery(
    { id: candidate.id, date: parsedDate ?? candidate.today, classId },
    { enabled: kind === "TRIAL" && Boolean(parsedDate && classId), retry: false },
  );
  const utils = trpc.useUtils();
  const mutation = trpc.admissions.schedule.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admissions.invalidate(), utils.teachers.invalidate()]);
      onClose();
    },
  });
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (mutation.isPending) return;
    const selected =
      meetings.data?.length === 1
        ? meetings.data[0]
        : meetings.data?.find((row) => (row.slotId ?? row.sessionId) === meetingKey);
    const parsed = entryVisitScheduleSchema.safeParse({
      id,
      candidateId: candidate.id,
      date: parsedDate ?? "",
      notes,
      ...(previousVisitId ? { previousVisitId } : {}),
      meeting:
        kind === "INTRODUCTION"
          ? { kind, teacherId: teacher?.id ?? "", startTime, endTime, format: candidate.format }
          : {
              kind,
              classId,
              scheduleSlotId: selected?.slotId ?? null,
              classSessionId: selected?.sessionId ?? null,
            },
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      );
      requestAnimationFrame(() =>
        popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          ref={popup}
          initialFocus={() => popup.current?.querySelector("input") ?? false}
        >
          <DialogHeader>
            <DialogTitle>
              {previousVisitId ? "Remarcar aula de entrada" : "Agendar aula de entrada"}
            </DialogTitle>
            <DialogDescription>{candidate.fullName}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form id="entry-visit-form" noValidate onSubmit={submit} className="grid gap-4 pt-4">
              <SegmentedControl
                size="sm"
                aria-label="Tipo de aula"
                value={kind}
                onValueChange={(value) => {
                  if (value === "TRIAL" || value === "INTRODUCTION") {
                    setKind(value);
                    setErrors({});
                    mutation.reset();
                  }
                }}
              >
                <SegmentedControlItem value="TRIAL">Experimental</SegmentedControlItem>
                <SegmentedControlItem value="INTRODUCTION">Introdutória</SegmentedControlItem>
              </SegmentedControl>
              <p className="text-caption text-muted-foreground">
                {kind === "TRIAL"
                  ? "Participação em uma aula de turma, no horário e com o professor do encontro."
                  : "Um encontro individual para conhecer o curso personalizado e seus materiais."}
              </p>
              <div className="w-40">
                <TextControl
                  name="date"
                  label="Data da aula"
                  placeholder="dd/mm/aaaa"
                  inputMode="numeric"
                  value={date}
                  onChange={(value) => {
                    setDate(maskDateBR(value));
                    setMeetingKey("");
                    setErrors({});
                  }}
                  error={errors.date}
                />
              </div>
              {kind === "TRIAL" ? (
                <>
                  <SelectControl
                    name="classId"
                    label="Turma"
                    value={classId}
                    choices={(classes.data ?? []).map((row) => ({
                      value: row.id,
                      label: row.name,
                    }))}
                    onChange={(value) => {
                      setClassId(value);
                      setMeetingKey("");
                      setErrors({});
                    }}
                    error={errors["meeting.classId"]}
                  />
                  {classes.isError && <Alert variant="warning">{classes.error.message}</Alert>}
                  {classes.data?.length === 0 && (
                    <p className="text-caption text-muted-foreground">
                      Nenhuma turma compatível com o interesse e os horários nesta data.
                    </p>
                  )}
                  {classId && meetings.data?.length === 1 && (
                    <div className="grid gap-1 rounded-md border border-border bg-muted p-3">
                      <p className="text-caption text-muted-foreground">Encontro da turma</p>
                      <p className="font-medium">
                        {meetings.data[0]!.startTime}–{meetings.data[0]!.endTime}
                      </p>
                      <p className="text-caption">
                        {meetings.data[0]!.substituteTeacherName ??
                          meetings.data[0]!.usualTeacherName ??
                          "Sem professor"}
                      </p>
                    </div>
                  )}
                  {meetings.isError && (
                    <Alert variant="destructive">{meetings.error.message}</Alert>
                  )}
                  {classId && (meetings.data?.length ?? 0) > 1 && (
                    <SelectControl
                      name="meeting"
                      label="Encontro da turma"
                      value={meetingKey}
                      onChange={(value) => {
                        setMeetingKey(value);
                        setErrors({});
                      }}
                      choices={(meetings.data ?? []).map((row) => ({
                        value: row.slotId ?? row.sessionId ?? "",
                        label: `${row.startTime}–${row.endTime} · ${row.substituteTeacherName ?? row.usualTeacherName ?? "Sem professor"}`,
                      }))}
                      error={errors.meeting}
                    />
                  )}
                  {classId && meetings.data?.length === 0 && (
                    <p className="text-caption text-muted-foreground">
                      A turma não tem aula nesta data. Escolha um dia do horário semanal.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <TeacherPicker
                    date={parsedDate ?? candidate.today}
                    value={teacher}
                    onChange={(value) => {
                      setTeacher(value);
                      setErrors({});
                    }}
                    error={errors["meeting.teacherId"] ?? null}
                  />
                  <FormRow columns={2}>
                    <TextControl
                      name="startTime"
                      label="Início"
                      placeholder="14:00"
                      inputMode="numeric"
                      value={startTime}
                      onChange={(value) => {
                        setStart(maskTime24(value));
                        setErrors({});
                      }}
                      error={errors["meeting.startTime"]}
                    />
                    <TextControl
                      name="endTime"
                      label="Término"
                      placeholder="15:00"
                      inputMode="numeric"
                      value={endTime}
                      onChange={(value) => {
                        setEnd(maskTime24(value));
                        setErrors({});
                      }}
                      error={errors["meeting.endTime"]}
                    />
                  </FormRow>
                  <p className="text-caption text-muted-foreground">
                    {candidate.format === "ONLINE" ? "Encontro online" : "Encontro presencial"}.
                    Conflitos do professor são verificados ao agendar.
                  </p>
                </>
              )}
              <TextControl
                name="notes"
                label="Orientações e material"
                placeholder="O que preparar ou levar para a aula"
                value={notes}
                onChange={setNotes}
              />
              {previousVisitId && (
                <Alert variant="neutral">
                  O agendamento anterior será preservado como remarcado.
                </Alert>
              )}
              {mutation.isError && <Alert variant="destructive">{mutation.error.message}</Alert>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" disabled={mutation.isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button form="entry-visit-form" type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Agendando…"
                : previousVisitId
                  ? "Confirmar remarcação"
                  : "Agendar aula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
