"use client";
import { useRef, type FormEvent, type ReactElement } from "react";
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
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { MembershipFields } from "./membership-fields";
import { useMembershipState, type MembershipMode } from "./membership-state";

type Props = {
  mode: MembershipMode;
  classId: string;
  scheduleType: "REGULAR" | "PERSONALIZED";
  open: boolean;
  onOpenChange: (value: boolean) => void;
};
function submitLabel(mode: MembershipMode, pending: boolean): string {
  if (pending) return "Salvando…";
  return mode === "ENTRY" ? "Matricular" : "Confirmar retorno";
}
function MembershipForm({
  mode,
  scheduleType,
  state,
  options,
  submit,
}: {
  mode: MembershipMode;
  scheduleType: Props["scheduleType"];
  state: ReturnType<typeof useMembershipState>;
  options: {
    data: RouterOutputs["classes"]["formOptions"] | undefined;
    isPending: boolean;
    isError: boolean;
  };
  submit: (event: FormEvent<HTMLFormElement>) => void;
}): ReactElement {
  return (
    <DialogBody className="mt-4">
      <form id="membership-form" noValidate onSubmit={submit}>
        {options.data && (
          <MembershipFields
            mode={mode}
            state={state}
            options={options.data}
            scheduleType={scheduleType}
          />
        )}
        {options.isPending && <p role="status">Carregando opções…</p>}
        {options.isError && <p role="alert">Não foi possível carregar as etapas.</p>}
      </form>
    </DialogBody>
  );
}
function MembershipBody({
  mode,
  classId,
  scheduleType,
  onDone,
}: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }): ReactElement {
  const popup = useRef<HTMLDivElement>(null);
  const state = useMembershipState({ classId, mode, onDone });
  const options = trpc.classes.formOptions.useQuery();
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    state.submit();
  }
  return (
    <DialogContent
      className="md:max-w-2xl"
      initialFocus={() =>
        popup.current?.querySelector<HTMLInputElement>('input[name="studentSearch"]') ?? true
      }
      ref={popup}
    >
      <DialogHeader>
        <DialogTitle>{mode === "ENTRY" ? "Matricular aluno" : "Retornar aluno"}</DialogTitle>
        <DialogDescription>
          Escolha o aluno, a data efetiva e a etapa quando a turma for PPT.
        </DialogDescription>
      </DialogHeader>
      <MembershipForm
        mode={mode}
        scheduleType={scheduleType}
        state={state}
        options={options}
        submit={submit}
      />
      {state.error && (
        <p role="alert" className="text-caption text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="secondary" disabled={state.pending} onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" form="membership-form" disabled={state.pending || !options.data}>
          {submitLabel(mode, state.pending)}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
export function MembershipDialog({
  mode,
  classId,
  scheduleType,
  open,
  onOpenChange,
}: Props): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        {open && (
          <MembershipBody
            mode={mode}
            classId={classId}
            scheduleType={scheduleType}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogPortal>
    </Dialog>
  );
}
