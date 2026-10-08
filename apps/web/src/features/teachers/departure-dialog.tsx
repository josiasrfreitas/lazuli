"use client";
import { useRef, useState, type FormEvent } from "react";
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
  Input,
  Label,
  InlineSkeleton,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { dateLabel } from "./format";
import { DepartureImpact } from "./departure-impact";
export function DepartureDialog({
  teacher,
  onClose,
}: {
  teacher: { id: string; name: string; today: string };
  onClose: () => void;
}) {
  const [date, setDate] = useState(dateLabel(teacher.today));
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const preview = trpc.teachers.previewDeparture.useQuery(
    { id: teacher.id, effectiveDate: previewDate ?? teacher.today },
    { enabled: previewDate !== null, retry: false, staleTime: 0 },
  );
  const save = trpc.teachers.depart.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.teachers.invalidate(), utils.classes.invalidate()]);
      onClose();
    },
    onError: (cause) => {
      setError(cause.message);
      setPreviewDate(null);
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = parseDateBR(date);
    if (!parsed || parsed < teacher.today) {
      setError("Informe hoje ou uma data futura.");
      first.current?.focus();
      return;
    }
    if (!previewDate) {
      setError(null);
      setPreviewDate(parsed);
      return;
    }
    if (preview.data && !preview.isFetching)
      save.mutate({ id: teacher.id, effectiveDate: previewDate, token: preview.data.token });
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
        <DialogContent initialFocus={first}>
          <DialogHeader>
            <DialogTitle>Encerrar atuação</DialogTitle>
            <DialogDescription>
              {teacher.name} continuará no cadastro e no histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="my-5">
            <form id="departure-form" noValidate onSubmit={submit} className="grid gap-4">
              <FormSection
                title="Data da saída"
                description="O acesso ao sistema será bloqueado a partir desta data."
              >
                <div className="w-40">
                  <Field>
                    <Label htmlFor="departure-date">Vigência</Label>
                    <Input
                      ref={first}
                      id="departure-date"
                      name="effectiveDate"
                      autoComplete="off"
                      placeholder="dd/mm/aaaa"
                      inputMode="numeric"
                      size="compact-responsive"
                      value={date}
                      invalid={Boolean(error)}
                      disabled={save.isPending}
                      onChange={(event) => {
                        setDate(maskDateBR(event.target.value));
                        setPreviewDate(null);
                        setError(null);
                      }}
                    />
                    {error && <FieldError match>{error}</FieldError>}
                  </Field>
                </div>
              </FormSection>
              {previewDate && preview.isFetching && (
                <p role="status" className="text-caption">
                  Calculando impactos <InlineSkeleton />
                </p>
              )}
              {previewDate && preview.isError && (
                <Alert variant="destructive">
                  <p>{preview.error.message}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact-responsive"
                    onClick={() => void preview.refetch()}
                  >
                    Tentar novamente
                  </Button>
                </Alert>
              )}
              {previewDate && preview.data && !preview.isFetching && (
                <DepartureImpact impact={preview.data} date={previewDate} />
              )}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button
              size="compact-responsive"
              variant="secondary"
              disabled={save.isPending}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              size="compact-responsive"
              type="submit"
              form="departure-form"
              disabled={
                save.isPending || (previewDate !== null && (preview.isFetching || preview.isError))
              }
            >
              {save.isPending
                ? "Confirmando…"
                : previewDate && preview.data
                  ? "Confirmar encerramento"
                  : "Ver impactos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
