"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
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
  Field,
  FieldError,
  FormRow,
  Input,
  Label,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

type Props = {
  detail: { id: string; internalCode: string; capacity: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
type State = {
  code: string;
  capacity: string;
  error: string | null;
  popup: RefObject<HTMLDivElement | null>;
  save: ReturnType<typeof trpc.classes.updateBasic.useMutation>;
  setCode: (value: string) => void;
  setCapacity: (value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};
function useEditClass({ detail, open, onOpenChange }: Props): State {
  const [code, setCode] = useState(detail.internalCode);
  const [capacity, setCapacity] = useState(String(detail.capacity));
  const [error, setError] = useState<string | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  useEffect(() => {
    if (open) {
      setCode(detail.internalCode);
      setCapacity(String(detail.capacity));
      setError(null);
    }
  }, [open, detail.internalCode, detail.capacity]);
  const save = trpc.classes.updateBasic.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.classes.byId.invalidate({ id: detail.id }),
        utils.classes.list.invalidate(),
      ]);
      onOpenChange(false);
    },
    onError: (cause) => setError(cause.message),
  });
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!code.trim() || !Number.isInteger(Number(capacity)) || Number(capacity) < 1) {
      setError("Informe código e capacidade válida.");
      return;
    }
    save.mutate({ id: detail.id, internalCode: code, capacity: Number(capacity) });
  }
  return {
    code,
    capacity,
    error,
    popup,
    save,
    setCode: (value) => {
      setCode(value);
      setError(null);
    },
    setCapacity: (value) => {
      setCapacity(value);
      setError(null);
    },
    submit,
  };
}
function EditFields({ state }: { state: State }): ReactElement {
  return (
    <FormRow columns={2}>
      <Field>
        <Label htmlFor="edit-internalCode">Código interno</Label>
        <Input
          id="edit-internalCode"
          name="internalCode"
          autoComplete="off"
          placeholder="Ex.: REG-2026-01"
          size="sm"
          value={state.code}
          onChange={(event) => state.setCode(event.target.value)}
        />
        <FieldError match={Boolean(state.error)}>{state.error}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="edit-capacity">Capacidade de referência</Label>
        <Input
          id="edit-capacity"
          name="capacity"
          autoComplete="off"
          inputMode="numeric"
          placeholder="12"
          size="sm"
          value={state.capacity}
          onChange={(event) => state.setCapacity(event.target.value)}
        />
      </Field>
    </FormRow>
  );
}
function EditContent({ state, close }: { state: State; close: () => void }): ReactElement {
  return (
    <DialogContent
      initialFocus={() =>
        state.popup.current?.querySelector<HTMLInputElement>('input[name="internalCode"]') ?? true
      }
      ref={state.popup}
    >
      <DialogHeader>
        <DialogTitle>Editar turma</DialogTitle>
        <DialogDescription>Altere a identificação e a capacidade informativa.</DialogDescription>
      </DialogHeader>
      <DialogBody className="mt-4">
        <form id="edit-class-form" noValidate onSubmit={state.submit}>
          <EditFields state={state} />
        </form>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" disabled={state.save.isPending} onClick={close}>
          Cancelar
        </Button>
        <Button type="submit" form="edit-class-form" disabled={state.save.isPending}>
          {state.save.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
export function ClassEditDialog(props: Props): ReactElement {
  const state = useEditClass(props);
  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!state.save.isPending) props.onOpenChange(next);
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <EditContent state={state} close={() => props.onOpenChange(false)} />
      </DialogPortal>
    </Dialog>
  );
}
