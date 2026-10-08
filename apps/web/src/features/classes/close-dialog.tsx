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
  FormRow,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
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
    <FormRow columns={2}>
      <Field>
        <Label>Ação</Label>
        <SegmentedControl
          aria-label="Ação do vínculo"
          size="sm"
          value={state.reason}
          onValueChange={(value) => {
            if (value === "SUSPENDED" || value === "DROPPED") state.setReason(value);
          }}
        >
          <SegmentedControlItem value="SUSPENDED">Pausar</SegmentedControlItem>
          <SegmentedControlItem value="DROPPED">Encerrar</SegmentedControlItem>
        </SegmentedControl>
      </Field>
      <Field>
        <Label htmlFor="effectiveDate">Data efetiva</Label>
        <Input
          id="effectiveDate"
          name="effectiveDate"
          autoComplete="off"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          size="sm"
          value={state.date}
          onChange={(event) => state.setDate(event.target.value)}
        />
      </Field>
    </FormRow>
  );
}
function CloseForm(input: CloseInput): ReactElement {
  const state = useCloseState(input);
  return (
    <DialogContent
      initialFocus={() =>
        state.popup.current?.querySelector<HTMLInputElement>('input[name="effectiveDate"]') ?? true
      }
      ref={state.popup}
    >
      <DialogHeader>
        <DialogTitle>
          {state.reason === "SUSPENDED" ? "Pausar vínculo" : "Encerrar vínculo"}
        </DialogTitle>
        <DialogDescription>
          {input.studentName} · a ocupação muda na data efetiva. Nenhuma nota, plano ou cobrança é
          alterada.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="mt-4">
        <form id="close-enrollment-form" noValidate onSubmit={state.submit}>
          <CloseFields state={state} />
        </form>
      </DialogBody>
      {state.error && (
        <p role="alert" className="text-caption text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="secondary" disabled={state.pending} onClick={input.onDone}>
          Cancelar
        </Button>
        <Button type="submit" form="close-enrollment-form" disabled={state.pending}>
          {state.pending ? "Salvando…" : "Confirmar"}
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
