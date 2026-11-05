"use client";
import type { RouterInputs } from "@lazuli/api";
import {
  type Dispatch,
  type SetStateAction,
  type RefObject,
  type ReactElement,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ToastAlert,
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
  FormRow,
  Input,
  Label,
  type SearchSelectOption,
} from "@lazuli/ui";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { trpc } from "~/lib/trpc";
import { dateLabel, todayInSchool } from "./format";
import { TeacherPicker } from "./teacher-picker";

export function AssignmentDialog(props: AssignmentDialogInput): ReactElement {
  const today = todayInSchool();
  const [date, setDate] = useState(dateLabel(today));
  const [selected, setSelected] = useState<SearchSelectOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const save = trpc.teachers.assignClass.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.classes.invalidate(),
        utils.teachers.invalidate(),
        utils.dashboard.invalidate(),
      ]);
      props.onClose();
    },
    onError: (cause) => setError(cause.message),
  });
  const submit = (event: FormEvent<HTMLFormElement>): void =>
    submitAssignment(event, {
      classId: props.classId,
      save,
      date,
      today,
      setError,
      first,
      selected,
      popup,
    });
  return (
    <AssignmentContent
      saveIsPending={save.isPending}
      onClose={props.onClose}
      popup={popup}
      first={first}
      classCode={props.classCode}
      submit={submit}
      date={date}
      setDate={setDate}
      setSelected={setSelected}
      setError={setError}
      error={error}
      today={today}
      selected={selected}
    />
  );
}

function AssignmentFooter({ onClose, saveIsPending }: AssignmentFooterInput): ReactElement {
  return (
    <DialogFooter>
      <Button
        size="compact-responsive"
        variant="secondary"
        onClick={onClose}
        disabled={saveIsPending}
      >
        Cancelar
      </Button>
      <Button
        size="compact-responsive"
        type="submit"
        form="assignment-form"
        disabled={saveIsPending}
      >
        {saveIsPending ? "Salvando…" : "Salvar atribuição"}
      </Button>
    </DialogFooter>
  );
}

function AssignmentFields({
  first,
  date,
  setDate,
  setSelected,
  setError,
  error,
  today,
  selected,
  saveIsPending,
}: AssignmentFieldsInput): ReactElement {
  return (
    <FormRow columns={3}>
      <div className="max-w-40">
        <Field>
          <Label htmlFor="assignment-date">A partir de</Label>
          <Input
            ref={first}
            id="assignment-date"
            name="effectiveDate"
            placeholder="dd/mm/aaaa"
            autoComplete="off"
            inputMode="numeric"
            size="compact-responsive"
            value={date}
            onChange={(event) => {
              setDate(maskDateBR(event.target.value));
              setSelected(null);
              setError(null);
            }}
            invalid={Boolean(error && !parseDateBR(date))}
          />
          <FieldError match={Boolean(error && !parseDateBR(date))}>{error}</FieldError>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <TeacherPicker
          date={parseDateBR(date) ?? today}
          value={selected}
          onChange={(value) => {
            setSelected(value);
            setError(null);
          }}
          disabled={saveIsPending}
        />
      </div>
    </FormRow>
  );
}

type AssignmentContentProps = {
  saveIsPending: boolean;
  onClose: () => void;
  popup: RefObject<HTMLDivElement | null>;
  first: RefObject<HTMLInputElement | null>;
  classCode: string;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  date: string;
  setDate: Dispatch<SetStateAction<string>>;
  setSelected: Dispatch<SetStateAction<SearchSelectOption | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  error: string | null;
  today: string;
  selected: SearchSelectOption | null;
};
function AssignmentContent(props: AssignmentContentProps): ReactElement {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(true);
  }, []);
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open && !props.saveIsPending) props.onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent data-class-dialog-motion ref={props.popup} initialFocus={props.first}>
          <DialogHeader>
            <DialogTitle>Trocar docente da turma</DialogTitle>
            <DialogDescription>
              {props.classCode} · a nova atribuição vale a partir da data escolhida.
            </DialogDescription>
          </DialogHeader>
          <AssignmentForm {...props} />
          <AssignmentFooter onClose={props.onClose} saveIsPending={props.saveIsPending} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function AssignmentForm(props: AssignmentContentProps): ReactElement {
  return (
    <DialogBody className="my-5">
      <form id="assignment-form" noValidate onSubmit={props.submit} className="grid gap-4">
        <FormSection
          title="Nova responsabilidade"
          description="Os responsáveis e registros anteriores à vigência permanecem no histórico."
        >
          <AssignmentFields
            first={props.first}
            date={props.date}
            setDate={props.setDate}
            setSelected={props.setSelected}
            setError={props.setError}
            error={props.error}
            today={props.today}
            selected={props.selected}
            saveIsPending={props.saveIsPending}
          />
        </FormSection>
        {props.error && <ToastAlert variant="destructive">{props.error}</ToastAlert>}
        <p className="text-caption text-muted-foreground">
          A cobertura será atualizada para os encontros deste período. Uma coincidência de horário
          impede a confirmação.
        </p>
      </form>
    </DialogBody>
  );
}

type SubmitAssignmentContext = {
  classId: string;
  save: { isPending: boolean; mutate: (values: RouterInputs["teachers"]["assignClass"]) => void };
  date: string;
  today: string;
  setError: Dispatch<SetStateAction<string | null>>;
  first: RefObject<HTMLInputElement | null>;
  selected: SearchSelectOption | null;
  popup: RefObject<HTMLDivElement | null>;
};
function submitAssignment(
  event: FormEvent<HTMLFormElement>,
  { classId, save, date, today, setError, first, selected, popup }: SubmitAssignmentContext,
): void {
  event.preventDefault();
  if (save.isPending) return;
  const parsed = parseDateBR(date);
  if (!parsed || parsed < today) {
    setError("Informe hoje ou uma data futura.");
    first.current?.focus();
    return;
  }
  if (!selected) {
    setError("Escolha o novo docente da turma.");
    popup.current?.querySelector<HTMLInputElement>('input[name="teacherId"]')?.focus();
    return;
  }
  save.mutate({ classId, teacherId: selected.id, effectiveDate: parsed });
}

type AssignmentDialogInput = {
  classId: string;
  classCode: string;
  onClose: () => void;
};
type AssignmentFooterInput = {
  onClose: () => void;
  saveIsPending: boolean;
};
type AssignmentFieldsInput = {
  first: RefObject<HTMLInputElement | null>;
  date: string;
  setDate: Dispatch<SetStateAction<string>>;
  setSelected: Dispatch<SetStateAction<SearchSelectOption | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  error: string | null;
  today: string;
  selected: SearchSelectOption | null;
  saveIsPending: boolean;
};
