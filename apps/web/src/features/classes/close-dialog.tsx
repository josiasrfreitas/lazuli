"use client";
import { useRef, useState, type FormEvent, type ReactElement, type RefObject } from "react";
import {
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
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import styles from "./close-dialog.module.css";
import { trpc } from "~/lib/trpc";
import { maskDateBR, parseDateBR } from "~/lib/masks";

type CloseReason = "SUSPENDED" | "DROPPED";
type CloseInput = {
  enrollmentId: string;
  classId: string;
  studentName: string;
  onDone: () => void;
};
type CloseState = {
  reason: CloseReason;
  setReason: (value: CloseReason) => void;
  confirmation: string;
  setConfirmation: (value: string) => void;
  confirmed: boolean;
  date: string;
  setDate: (value: string) => void;
  error: string | null;
  popup: RefObject<HTMLDivElement | null>;
  pending: boolean;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};
function useCloseState(input: CloseInput): CloseState {
  const [reason, setReason] = useState<CloseReason>("SUSPENDED");
  const [date, saveDate] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const normalize = (value: string): string =>
    value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pt-BR");
  const confirmed = normalize(confirmation) === normalize(input.studentName);
  const [error, setError] = useState<string | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const close = trpc.enrollment.close.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.classes.byId.invalidate({ id: input.classId }),
        utils.classes.roster.invalidate({ id: input.classId }),
        utils.classes.actions.invalidate({ id: input.classId }),
        utils.classes.list.invalidate(),
      ]);
      input.onDone();
    },
    onError: (cause) => setError(cause.message),
  });
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (close.isPending || !confirmed) return;
    const iso = parseDateBR(date);
    if (!iso) {
      setError("Informe uma data válida.");
      return;
    }
    close.mutate({ enrollmentId: input.enrollmentId, reason, effectiveDate: new Date(iso) });
  }
  return {
    reason,
    setReason,
    confirmation,
    setConfirmation,
    confirmed,
    date,
    setDate: (value) => {
      saveDate(maskDateBR(value));
      setError(null);
    },
    error,
    popup,
    pending: close.isPending,
    submit,
  };
}
function CloseFields({ state }: { state: CloseState }): ReactElement {
  return (
    <div className={styles.fields}>
      <Field>
        <Label>Ação</Label>
        <SegmentedControl
          aria-label="Ação do vínculo"
          size="sm"
          disabled={state.pending}
          value={state.reason}
          onValueChange={(value) => {
            if (value === "SUSPENDED" || value === "DROPPED") state.setReason(value);
          }}
        >
          <SegmentedControlItem value="SUSPENDED">Pausar</SegmentedControlItem>
          <SegmentedControlItem value="DROPPED">Encerrar</SegmentedControlItem>
        </SegmentedControl>
      </Field>
      <Field className={styles.date}>
        <Label htmlFor="effectiveDate">Data efetiva</Label>
        <Input
          id="effectiveDate"
          name="effectiveDate"
          autoComplete="off"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          size="sm"
          value={state.date}
          disabled={state.pending}
          aria-describedby="membership-effective-help"
          invalid={Boolean(state.error)}
          onChange={(event) => state.setDate(event.target.value)}
        />
        {state.error && <FieldError match>{state.error}</FieldError>}
      </Field>
    </div>
  );
}
function CloseForm(input: CloseInput): ReactElement {
  const state = useCloseState(input);
  return (
    <DialogContent
      className="md:max-w-md"
      motion="subtle"
      initialFocus={() =>
        state.popup.current?.querySelector<HTMLInputElement>('input[name="effectiveDate"]') ?? true
      }
      ref={state.popup}
    >
      <DialogHeader>
        <DialogTitle>
          {state.reason === "SUSPENDED" ? "Pausar vínculo" : "Encerrar vínculo"}
        </DialogTitle>
        <DialogDescription>{input.studentName}</DialogDescription>
      </DialogHeader>
      <DialogBody className="mt-4">
        <form id="close-enrollment-form" noValidate onSubmit={state.submit}>
          <CloseFields state={state} />
          <p id="membership-effective-help" className={styles.help}>
            {state.reason === "SUSPENDED"
              ? "O aluno sai da lista ativa nessa data e poderá retomar o vínculo depois."
              : "O vínculo com esta turma termina nessa data."}
          </p>
          <p className={styles.note}>Notas, plano e cobranças permanecem como estão.</p>
          <Field className={styles.confirmation}>
            <Label htmlFor="confirm-student">Digite o nome completo do aluno para confirmar</Label>
            <Input
              id="confirm-student"
              name="confirmStudent"
              autoComplete="off"
              placeholder={input.studentName}
              size="sm"
              value={state.confirmation}
              disabled={state.pending}
              onChange={(event) => state.setConfirmation(event.target.value)}
            />
          </Field>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button
          size="sm"
          type="button"
          variant="secondary"
          disabled={state.pending}
          onClick={input.onDone}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="destructive"
          type="submit"
          form="close-enrollment-form"
          disabled={state.pending || !state.confirmed}
        >
          {state.pending
            ? "Salvando…"
            : state.reason === "SUSPENDED"
              ? "Pausar vínculo"
              : "Encerrar vínculo"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
export function CloseMembershipDialog({
  enrollment,
  classId,
  onOpenChange,
}: {
  enrollment: { id: string; studentName: string } | null;
  classId: string;
  onOpenChange: (value: boolean) => void;
}): ReactElement {
  return (
    <Dialog open={enrollment !== null} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        {enrollment && (
          <CloseForm
            enrollmentId={enrollment.id}
            classId={classId}
            studentName={enrollment.studentName}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogPortal>
    </Dialog>
  );
}
