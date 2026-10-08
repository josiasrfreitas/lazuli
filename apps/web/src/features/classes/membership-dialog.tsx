"use client";
import {
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
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
import { ReturnDestination } from "./return-destination";
import { MembershipFields } from "./membership-fields";
import { useMembershipState, type MembershipMode } from "./membership-state";

type Props = {
  mode: MembershipMode;
  source?: { id: string; name: string } | undefined;
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
  source,
  destination,
}: {
  mode: MembershipMode;
  scheduleType: Props["scheduleType"];
  state: ReturnType<typeof useMembershipState>;
  options: {
    data: RouterOutputs["classes"]["formOptions"] | undefined;
    isPending: boolean;
    isError: boolean;
  };
  source: Props["source"];
  destination: ReactNode;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}): ReactElement {
  return (
    <DialogBody className="mt-4">
      <form id="membership-form" className="space-y-4" noValidate onSubmit={submit}>
        {options.data && (
          <>
            {destination}
            <MembershipFields
              sourceName={source?.name}
              mode={mode}
              state={state}
              options={options.data}
              scheduleType={scheduleType}
            />
          </>
        )}
        {options.isPending && <p role="status">Carregando opções…</p>}
        {options.isError && <p role="alert">Não foi possível carregar as etapas.</p>}
      </form>
    </DialogBody>
  );
}
type BodyProps = Omit<Props, "open" | "onOpenChange"> & { onDone: () => void };
type BodyState = {
  popup: RefObject<HTMLDivElement | null>;
  target: { classId: string; scheduleType: Props["scheduleType"] };
  state: ReturnType<typeof useMembershipState>;
  options: {
    data: RouterOutputs["classes"]["formOptions"] | undefined;
    isPending: boolean;
    isError: boolean;
  };
  submit: (event: FormEvent<HTMLFormElement>) => void;
  destination: ReactNode;
};
function useMembershipBodyState({
  mode,
  classId,
  scheduleType,
  onDone,
  source,
}: BodyProps): BodyState {
  const popup = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState({ classId, scheduleType });
  const state = useMembershipState({
    classId: target.classId,
    mode,
    onDone,
    sourceEnrollmentId: source?.id,
  });
  const options = trpc.classes.formOptions.useQuery();
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    state.submit();
  }
  const destination = source && (
    <ReturnDestination
      value={target}
      onChange={(value) => {
        setTarget(value);
        state.setStageId("");
      }}
    />
  );
  return { popup, target, state, options, submit, destination };
}

function MembershipBody({ mode, classId, scheduleType, onDone, source }: BodyProps): ReactElement {
  const { popup, target, state, options, submit, destination } = useMembershipBodyState({
    mode,
    classId,
    scheduleType,
    onDone,
    source,
  });
  return (
    <DialogContent
      className="md:max-w-md"
      initialFocus={() =>
        popup.current?.querySelector<HTMLInputElement>(
          source ? 'input[name="targetClassId"]' : 'input[name="studentSearch"]',
        ) ?? true
      }
      ref={popup}
    >
      <MembershipHeader
        mode={mode}
        scheduleType={target.scheduleType}
        contextual={Boolean(source)}
      />
      <MembershipForm
        source={source}
        destination={destination}
        mode={mode}
        scheduleType={target.scheduleType}
        state={state}
        options={options}
        submit={submit}
      />
      {state.error && (
        <p role="alert" className="text-caption text-destructive">
          {state.error}
        </p>
      )}
      <MembershipFooter mode={mode} state={state} ready={Boolean(options.data)} onDone={onDone} />
    </DialogContent>
  );
}
function MembershipFooter({
  mode,
  state,
  ready,
  onDone,
}: {
  mode: MembershipMode;
  state: ReturnType<typeof useMembershipState>;
  ready: boolean;
  onDone: () => void;
}): ReactElement {
  return (
    <DialogFooter>
      <Button type="button" variant="secondary" disabled={state.pending} onClick={onDone}>
        Cancelar
      </Button>
      <Button type="submit" form="membership-form" disabled={state.pending || !ready}>
        {submitLabel(mode, state.pending)}
      </Button>
    </DialogFooter>
  );
}

function MembershipHeader({
  mode,
  scheduleType,
  contextual,
}: {
  mode: MembershipMode;
  scheduleType: Props["scheduleType"];
  contextual: boolean;
}): ReactElement {
  const description = contextual
    ? "Escolha a turma de destino e a data de retorno. O histórico da pausa será preservado."
    : "Escolha o aluno e a data de entrada.";
  return (
    <DialogHeader>
      <DialogTitle>{mode === "ENTRY" ? "Matricular aluno" : "Retomar matrícula"}</DialogTitle>
      <DialogDescription>
        {description}
        {scheduleType === "PERSONALIZED" && " Informe também o estágio individual."}
      </DialogDescription>
    </DialogHeader>
  );
}

export function MembershipDialog({
  mode,
  classId,
  scheduleType,
  open,
  onOpenChange,
  source,
}: Props): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        {open && (
          <MembershipBody
            source={source}
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
