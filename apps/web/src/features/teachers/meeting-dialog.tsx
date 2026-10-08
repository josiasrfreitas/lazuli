"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
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
  Field,
  FieldError,
  FormSection,
  Label,
  SearchSelect,
  type SearchSelectOption,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { dateLabel, hoursLabel, todayInSchool } from "./format";
export type Meeting = RouterOutputs["teachers"]["week"]["rows"][number];
export function MeetingDialog({
  meeting,
  back,
  onClose,
}: {
  meeting: Meeting;
  back: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SearchSelectOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const options = trpc.teachers.options.useQuery({ date: meeting.date, search });
  const utils = trpc.useUtils();
  const save = trpc.teachers.substitute.useMutation({
    onSuccess: async () => {
      await utils.teachers.invalidate();
      onClose();
    },
    onError: (cause) => setError(cause.message),
  });
  const canChange =
    meeting.date >= todayInSchool() && !meeting.substituteTeacherId && meeting.editable;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || !canChange) return;
    if (!selected) {
      setError("Escolha o professor que irá assumir este encontro.");
      popup.current?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    save.mutate({
      classId: meeting.classId,
      scheduleSlotId: meeting.slotId,
      classSessionId: meeting.slotId ? null : meeting.sessionId,
      date: meeting.date,
      teacherId: selected.id,
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          ref={popup}
          initialFocus={() => popup.current?.querySelector<HTMLInputElement>("input") ?? true}
        >
          <DialogHeader>
            <DialogTitle>{meeting.classCode}</DialogTitle>
            <DialogDescription>
              {dateLabel(meeting.date)} · {meeting.startTime}–{meeting.endTime} ·{" "}
              {hoursLabel(meeting.minutes)} horas-aula
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="my-5">
            <form id="substitute-form" onSubmit={submit} noValidate className="grid gap-5">
              <dl className="grid gap-3 border-b border-border pb-4 text-control">
                <div>
                  <dt className="text-caption text-muted-foreground">Docente da turma</dt>
                  <dd>{meeting.usualTeacherName ?? "Sem professor nesta data"}</dd>
                </div>
                {meeting.substituteTeacherName &&
                  meeting.substituteTeacherId !== meeting.usualTeacherId && (
                    <div>
                      <dt className="text-caption text-muted-foreground">
                        Substituto neste encontro
                      </dt>
                      <dd>{meeting.substituteTeacherName}</dd>
                    </div>
                  )}
              </dl>
              {meeting.requiresCoverage && !meeting.substituteTeacherId && (
                <Alert variant="warning">
                  A cobertura anterior foi desfeita por uma saída. Este encontro precisa de uma nova
                  atribuição.
                </Alert>
              )}
              {canChange ? (
                <FormSection
                  title={meeting.usualTeacherId ? "Registrar substituição" : "Cobrir este encontro"}
                  description="A escolha vale para todo o intervalo deste encontro."
                >
                  <Field>
                    <Label>Professor que irá assumir</Label>
                    <SearchSelect
                      size="compact-responsive"
                      name="substituteTeacher"
                      placeholder="Buscar professor por nome"
                      query={search}
                      value={selected}
                      options={(options.data ?? [])
                        .filter(
                          (teacher) =>
                            teacher.id !== meeting.usualTeacherId || meeting.requiresCoverage,
                        )
                        .map((teacher) => ({ id: teacher.id, label: teacher.name }))}
                      loading={options.isFetching}
                      failed={options.isError}
                      invalid={Boolean(error)}
                      disabled={save.isPending}
                      onQueryChange={setSearch}
                      onSelect={(value) => {
                        setSelected(value);
                        setError(null);
                      }}
                      onClear={() => setSelected(null)}
                    />
                    {error && <FieldError match>{error}</FieldError>}
                  </Field>
                </FormSection>
              ) : (
                <Alert variant="neutral">
                  {meeting.substituteTeacherId
                    ? "A substituição está registrada. O docente da turma permanece responsável pelos demais encontros."
                    : "Este encontro está disponível para consulta. Alterações retroativas ou em aulas já registradas não estão disponíveis."}
                </Alert>
              )}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button
              size="compact-responsive"
              variant="secondary"
              nativeButton={false}
              render={
                <Link href={`/turmas/${meeting.classId}?voltar=${encodeURIComponent(back)}`} />
              }
            >
              Abrir turma
            </Button>
            {canChange ? (
              <Button
                size="compact-responsive"
                type="submit"
                form="substitute-form"
                disabled={save.isPending}
              >
                {save.isPending ? "Salvando…" : "Salvar cobertura"}
              </Button>
            ) : (
              <Button size="compact-responsive" onClick={onClose}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
