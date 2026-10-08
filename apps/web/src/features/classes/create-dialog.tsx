"use client";
import { useRef, useState, type FormEvent, type ReactElement, type RefObject } from "react";
import { useRouter } from "next/navigation";
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
import { classCreateInputSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { ClassCreateFields, initialClassDraft, type ClassDraft } from "./create-fields";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };
type State = {
  draft: ClassDraft;
  errors: Record<string, string>;
  formError: string | null;
  popup: RefObject<HTMLDivElement | null>;
  create: ReturnType<typeof trpc.classes.create.useMutation>;
  change: <K extends keyof ClassDraft>(field: K, value: ClassDraft[K]) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  close: () => void;
};
function parseClassDraft(draft: ClassDraft): ReturnType<typeof classCreateInputSchema.safeParse> {
  return classCreateInputSchema.safeParse({
    internalCode: draft.internalCode,
    teacherId: draft.teacherId,
    scheduleType: draft.scheduleType,
    format: draft.format,
    semesterId: draft.semesterId,
    year: Number(draft.year),
    capacity: Number(draft.capacity),
    slots: draft.slots,
    ...(draft.scheduleType === "REGULAR"
      ? { sharedStageId: draft.sharedStageId }
      : { portalClassName: draft.portalClassName }),
  });
}
const useCreateClass = ({ onOpenChange }: Props): State => {
  const [draft, setDraft] = useState<ClassDraft>(initialClassDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const utils = trpc.useUtils();
  const create = trpc.classes.create.useMutation({
    onSuccess: async (created) => {
      await utils.classes.list.invalidate();
      onOpenChange(false);
      router.push(`/turmas/${created.id}`);
    },
    onError: (cause) => setFormError(cause.message),
  });
  function change<K extends keyof ClassDraft>(field: K, value: ClassDraft[K]): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setFormError(null);
  }
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = parseClassDraft(draft);
    if (parsed.success) {
      create.mutate(parsed.data);
      return;
    }
    const fields = parsed.error.flatten().fieldErrors;
    setErrors(
      Object.fromEntries(
        Object.entries(fields).map(([key, messages]) => [key, messages?.[0] ?? "Campo inválido."]),
      ),
    );
    const first = Object.keys(fields)[0];
    if (first) popup.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }
  return {
    draft,
    errors,
    formError,
    popup,
    create,
    change,
    submit,
    close: () => onOpenChange(false),
  };
};
function CreateForm({
  state,
  options,
}: {
  state: State;
  options: NonNullable<RouterOutputs["classes"]["formOptions"]>;
}): ReactElement {
  return (
    <form id="create-class-form" noValidate onSubmit={state.submit}>
      <fieldset disabled={state.create.isPending}>
        <ClassCreateFields
          draft={state.draft}
          change={state.change}
          options={options}
          errors={state.errors}
        />
      </fieldset>
    </form>
  );
}
function CreateBody({ state, open }: { state: State; open: boolean }): ReactElement {
  const options = trpc.classes.formOptions.useQuery(undefined, { enabled: open });
  return (
    <>
      <DialogBody className="mt-4">
        {options.isError && (
          <p role="alert">
            Não foi possível carregar as opções.{" "}
            <Button type="button" variant="link" onClick={() => void options.refetch()}>
              Tentar novamente
            </Button>
          </p>
        )}
        {options.isPending && <p role="status">Carregando opções…</p>}
        {options.data && <CreateForm state={state} options={options.data} />}
      </DialogBody>
      {state.formError && (
        <p role="alert" className="text-caption text-destructive">
          {state.formError}
        </p>
      )}
      <DialogFooter>
        <Button
          type="button"
          variant="secondary"
          disabled={state.create.isPending}
          onClick={() => state.close()}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          form="create-class-form"
          disabled={!options.data || state.create.isPending}
        >
          {state.create.isPending ? "Criando…" : "Criar turma"}
        </Button>
      </DialogFooter>
    </>
  );
}
function CreateContent({ state, open }: { state: State; open: boolean }): ReactElement {
  return (
    <DialogContent
      className="md:max-w-2xl"
      initialFocus={() =>
        state.popup.current?.querySelector<HTMLInputElement>('input[name="internalCode"]') ?? true
      }
      ref={state.popup}
    >
      <DialogHeader>
        <DialogTitle>Nova turma</DialogTitle>
        <DialogDescription>
          Defina a modalidade, o professor e os horários da turma.
        </DialogDescription>
      </DialogHeader>
      <CreateBody state={state} open={open} />
    </DialogContent>
  );
}
export function ClassCreateDialog(props: Props): ReactElement {
  const state = useCreateClass(props);
  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!state.create.isPending) props.onOpenChange(next);
      }}
    >
      <DialogPortal>
        <DialogBackdrop /> <CreateContent state={state} open={props.open} />
      </DialogPortal>
    </Dialog>
  );
}
