"use client";
import { type QueryResult, trpc } from "~/lib/trpc";
import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import {
  type RefObject,
  type Dispatch,
  type SetStateAction,
  type ReactElement,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
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
import { MeetingGuests } from "./meeting-guests";
import { dateLabel, hoursLabel, todayInSchool } from "./format";

export type Meeting = RouterOutputs["teachers"]["week"]["rows"][number];
export function MeetingDialog({ meeting, back, onClose }: MeetingDialogInput): ReactElement {
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
  const submit = (event: FormEvent<HTMLFormElement>): void =>
    submitSubstitution(event, {
      save,
      canChange,
      selected,
      setError,
      popup,
      meeting,
    });
  return (
    <MeetingContent
      saveIsPending={save.isPending}
      onClose={onClose}
      popup={popup}
      meeting={meeting}
      submit={submit}
      canChange={canChange}
      search={search}
      selected={selected}
      options={options}
      error={error}
      setSearch={setSearch}
      setSelected={setSelected}
      setError={setError}
      back={back}
    />
  );
}

type MeetingFooterProps = {
  meeting: Meeting;
  back: string;
  canChange: boolean;
  saveIsPending: boolean;
  onClose: () => void;
};
function MeetingFooter(props: MeetingFooterProps): ReactElement {
  return (
    <DialogFooter>
      <Button
        size="compact-responsive"
        variant="secondary"
        nativeButton={false}
        render={
          <Link
            href={`/turmas/${props.meeting.classId}?voltar=${encodeURIComponent(props.back)}`}
          />
        }
      >
        Abrir turma
      </Button>
      {props.canChange ? (
        <Button
          size="compact-responsive"
          type="submit"
          form="substitute-form"
          disabled={props.saveIsPending}
        >
          {props.saveIsPending ? "Salvando…" : "Salvar cobertura"}
        </Button>
      ) : (
        <Button size="compact-responsive" onClick={props.onClose}>
          Fechar
        </Button>
      )}
    </DialogFooter>
  );
}

type MeetingReplacementProps = {
  meeting: Meeting;
  search: string;
  selected: SearchSelectOption | null;
  options: QueryResult<RouterOutputs["teachers"]["options"]>;
  error: string | null;
  saveIsPending: boolean;
  setSearch: Dispatch<SetStateAction<string>>;
  setSelected: Dispatch<SetStateAction<SearchSelectOption | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
};
function MeetingReplacement(props: MeetingReplacementProps): ReactElement {
  return (
    <FormSection
      title={props.meeting.usualTeacherId ? "Registrar substituição" : "Cobrir este encontro"}
      description="A escolha vale para todo o intervalo deste encontro."
    >
      <Field>
        <Label>Professor que irá assumir</Label>
        <SearchSelect
          size="compact-responsive"
          name="substituteTeacher"
          placeholder="Buscar professor por nome"
          query={props.search}
          value={props.selected}
          options={(props.options.data ?? [])
            .filter(
              (teacher) =>
                teacher.id !== props.meeting.usualTeacherId || props.meeting.requiresCoverage,
            )
            .map((teacher) => ({ id: teacher.id, label: teacher.name }))}
          loading={props.options.isFetching}
          failed={props.options.isError}
          invalid={Boolean(props.error)}
          disabled={props.saveIsPending}
          onQueryChange={props.setSearch}
          onSelect={(value) => {
            props.setSelected(value);
            props.setError(null);
          }}
          onClear={() => props.setSelected(null)}
        />
        {props.error && <FieldError match>{props.error}</FieldError>}
      </Field>
    </FormSection>
  );
}

type MeetingContentProps = {
  saveIsPending: boolean;
  onClose: () => void;
  popup: RefObject<HTMLDivElement | null>;
  meeting: Meeting;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  canChange: boolean;
  search: string;
  selected: SearchSelectOption | null;
  options: QueryResult<RouterOutputs["teachers"]["options"]>;
  error: string | null;
  setSearch: Dispatch<SetStateAction<string>>;
  setSelected: Dispatch<SetStateAction<SearchSelectOption | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  back: string;
};
function MeetingContent(props: MeetingContentProps): ReactElement {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !props.saveIsPending) props.onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          ref={props.popup}
          initialFocus={() => props.popup.current?.querySelector<HTMLInputElement>("input") ?? true}
        >
          <MeetingHeader meeting={props.meeting} />
          <DialogBody className="my-5">
            <MeetingForm
              submit={props.submit}
              meeting={props.meeting}
              canChange={props.canChange}
              search={props.search}
              selected={props.selected}
              options={props.options}
              error={props.error}
              saveIsPending={props.saveIsPending}
              setSearch={props.setSearch}
              setSelected={props.setSelected}
              setError={props.setError}
            />
          </DialogBody>
          <MeetingFooter
            meeting={props.meeting}
            back={props.back}
            canChange={props.canChange}
            saveIsPending={props.saveIsPending}
            onClose={props.onClose}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

type SubmitSubstitutionContext = {
  save: { isPending: boolean; mutate: (values: RouterInputs["teachers"]["substitute"]) => void };
  canChange: boolean;
  selected: SearchSelectOption | null;
  setError: Dispatch<SetStateAction<string | null>>;
  popup: RefObject<HTMLDivElement | null>;
  meeting: Meeting;
};
function submitSubstitution(
  event: FormEvent<HTMLFormElement>,
  { save, canChange, selected, setError, popup, meeting }: SubmitSubstitutionContext,
): void {
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

type MeetingDialogInput = {
  meeting: Meeting;
  back: string;
  onClose: () => void;
};

type MeetingHeaderProps = { meeting: Meeting };
function MeetingHeader(props: MeetingHeaderProps): ReactElement {
  return (
    <DialogHeader>
      <DialogTitle>{props.meeting.classCode}</DialogTitle>
      <DialogDescription>
        {dateLabel(props.meeting.date)} · {props.meeting.startTime}–{props.meeting.endTime} ·{" "}
        {hoursLabel(props.meeting.minutes)} horas-aula
      </DialogDescription>
    </DialogHeader>
  );
}

type MeetingResponsibilityProps = { meeting: Meeting };
function MeetingResponsibility(props: MeetingResponsibilityProps): ReactElement {
  return (
    <dl className="grid gap-3 border-b border-border pb-4 text-control">
      <div>
        <dt className="text-caption text-muted-foreground">Docente da turma</dt>
        <dd>{props.meeting.usualTeacherName ?? "Sem professor nesta data"}</dd>
      </div>
      {props.meeting.substituteTeacherName &&
        props.meeting.substituteTeacherId !== props.meeting.usualTeacherId && (
          <div>
            <dt className="text-caption text-muted-foreground">Substituto neste encontro</dt>
            <dd>{props.meeting.substituteTeacherName}</dd>
          </div>
        )}
    </dl>
  );
}

type MeetingFormProps = {
  submit: (event: FormEvent<HTMLFormElement>) => void;
  meeting: Meeting;
  canChange: boolean;
  search: string;
  selected: SearchSelectOption | null;
  options: QueryResult<RouterOutputs["teachers"]["options"]>;
  error: string | null;
  saveIsPending: boolean;
  setSearch: Dispatch<SetStateAction<string>>;
  setSelected: Dispatch<SetStateAction<SearchSelectOption | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
};
function MeetingForm(props: MeetingFormProps): ReactElement {
  return (
    <form id="substitute-form" onSubmit={props.submit} noValidate className="grid gap-5">
      <MeetingResponsibility meeting={props.meeting} />
      <MeetingGuests meeting={props.meeting} />
      {props.meeting.requiresCoverage && !props.meeting.substituteTeacherId && (
        <Alert variant="warning">
          A cobertura anterior foi desfeita por uma saída. Este encontro precisa de uma nova
          atribuição.
        </Alert>
      )}
      {props.canChange ? (
        <MeetingReplacement
          meeting={props.meeting}
          search={props.search}
          selected={props.selected}
          options={props.options}
          error={props.error}
          saveIsPending={props.saveIsPending}
          setSearch={props.setSearch}
          setSelected={props.setSelected}
          setError={props.setError}
        />
      ) : (
        <Alert variant="neutral">
          {props.meeting.substituteTeacherId
            ? "A substituição está registrada. O docente da turma permanece responsável pelos demais encontros."
            : "Este encontro está disponível para consulta. Alterações retroativas ou em aulas já registradas não estão disponíveis."}
        </Alert>
      )}
    </form>
  );
}
