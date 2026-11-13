"use client";
import {
  useRef,
  useState,
  type ReactElement,
  type RefObject,
  type FormEvent,
  type ReactNode,
} from "react";
import { Check, UsersRound } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { classCapacityInputSchema } from "@lazuli/validators";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Field,
  FieldError,
  Input,
  Label,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

export function CapacityDialog({
  detail,
  onClose,
}: {
  detail: RouterOutputs["classes"]["byId"];
  onClose: () => void;
}): ReactElement {
  const [value, setValue] = useState(String(detail.capacity));
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const save = trpc.classes.updateCapacity.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.classes.invalidate(),
        utils.admissions.invalidate(),
        utils.students.invalidate(),
      ]);
      onClose();
    },
    onError: (cause) => setError(cause.message),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent initialFocus={first} className="md:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <UsersRound aria-hidden="true" className="size-5 shrink-0" />
                Editar capacidade máxima
              </span>
            </DialogTitle>
            <DialogDescription>
              {detail.portalClassName} · {detail.occupancy} matrículas ativas
            </DialogDescription>
          </DialogHeader>
          <CapacityForm
            value={value}
            error={error}
            pending={save.isPending}
            first={first}
            occupancy={detail.occupancy}
            action={
              <Button size="sm" type="submit" disabled={save.isPending}>
                <Check aria-hidden="true" />
                {save.isPending ? "Salvando…" : "Salvar"}
              </Button>
            }
            change={(next) => {
              setValue(next);
              setError(null);
            }}
            submit={(event) => {
              event.preventDefault();
              if (save.isPending) return;
              const result = classCapacityInputSchema.safeParse({
                id: detail.id,
                capacity: Number(value),
              });
              if (!result.success) {
                setError(result.error.issues[0]?.message ?? "Informe uma capacidade válida.");
                first.current?.focus();
                return;
              }
              save.mutate(result.data);
            }}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export function CapacityForm({
  value,
  error,
  pending,
  first,
  occupancy,
  action,
  change,
  submit,
}: {
  value: string;
  error: string | null;
  pending: boolean;
  first: RefObject<HTMLInputElement | null>;
  occupancy: number;
  action?: ReactNode;
  change: (value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}): ReactElement {
  return (
    <form id="class-capacity-form" noValidate onSubmit={submit}>
      <DialogBody>
        <div className="grid gap-3 pt-4">
          <div className="flex items-end gap-3">
            <div className="min-w-0">
              <Field>
                <Label htmlFor="class-capacity">Capacidade máxima</Label>
                <Input
                  ref={first}
                  id="class-capacity"
                  name="capacity"
                  placeholder="Ex.: 16"
                  autoComplete="off"
                  inputMode="numeric"
                  size="sm"
                  className="w-48"
                  value={value}
                  disabled={pending}
                  invalid={Boolean(error)}
                  onChange={(event) => change(event.target.value)}
                />
                <FieldError match={Boolean(error)}>{error}</FieldError>
              </Field>
            </div>
            {action}
          </div>
          <p className="text-caption text-muted-foreground">
            As matrículas existentes serão mantidas.
          </p>
          {Number(value) > 0 && Number(value) < occupancy && (
            <p role="status" className="text-caption text-warning-foreground">
              A turma ficará acima da capacidade informada.
            </p>
          )}
        </div>
      </DialogBody>
    </form>
  );
}
