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
  FormRow,
  Input,
  Label,
  type SearchSelectOption,
} from "@lazuli/ui";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { trpc } from "~/lib/trpc";
import { dateLabel, todayInSchool } from "./format";
import { TeacherPicker } from "./teacher-picker";
export function AssignmentDialog({
  classId,
  classCode,
  onClose,
}: {
  classId: string;
  classCode: string;
  onClose: () => void;
}) {
  const today = todayInSchool();
  const [date, setDate] = useState(dateLabel(today));
  const [selected, setSelected] = useState<SearchSelectOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const save = trpc.teachers.assignClass.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.classes.invalidate(), utils.teachers.invalidate()]);
      onClose();
    },
    onError: (cause) => setError(cause.message),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent ref={popup} initialFocus={first}>
          <DialogHeader>
            <DialogTitle>Trocar docente da turma</DialogTitle>
            <DialogDescription>
              {classCode} · a nova atribuição vale a partir da data escolhida.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="my-5">
            <form id="assignment-form" noValidate onSubmit={submit} className="grid gap-4">
              <FormSection
                title="Nova responsabilidade"
                description="Os responsáveis e registros anteriores à vigência permanecem no histórico."
              >
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
                      disabled={save.isPending}
                    />
                  </div>
                </FormRow>
              </FormSection>
              {error && <Alert variant="destructive">{error}</Alert>}
              <p className="text-caption text-muted-foreground">
                A cobertura será atualizada para os encontros deste período. Uma coincidência de
                horário impede a confirmação.
              </p>
            </form>
          </DialogBody>
          <DialogFooter>
            <Button
              size="compact-responsive"
              variant="secondary"
              onClick={onClose}
              disabled={save.isPending}
            >
              Cancelar
            </Button>
            <Button
              size="compact-responsive"
              type="submit"
              form="assignment-form"
              disabled={save.isPending}
            >
              {save.isPending ? "Salvando…" : "Salvar atribuição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
