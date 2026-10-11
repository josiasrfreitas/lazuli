"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X } from "lucide-react";
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
  FormRow,
  FormSection,
  Input,
  Label,
  SearchSelect,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { admissionValuesSchema } from "@lazuli/validators";
import type { RouterInputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { useScrollToError } from "~/lib/scroll-to-error";
import { maskDateBR, maskPhoneBR, maskTime24, parseDateBR } from "~/lib/masks";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { StudentLink } from "./student-link";
import { dateLabel, timeLabel, weekdays, type Candidate } from "./labels";

type Values = RouterInputs["admissions"]["save"]["values"];
type Draft = Omit<Values, "availableUntil"> & { availableUntil: string };
function initialDraft(candidate?: Candidate): Draft {
  return {
    fullName: candidate?.fullName ?? "",
    phone: candidate?.phone ?? "",
    email: candidate?.email ?? "",
    notes: candidate?.notes ?? "",
    stageId: candidate?.stageId ?? null,
    studentId: candidate?.studentId ?? null,
    scheduleType: candidate?.scheduleType ?? "REGULAR",
    format: candidate?.format ?? "IN_PERSON",
    availableUntil: candidate ? dateLabel(candidate.availableUntil) : "",
    availability: candidate?.availability.map((slot) => ({
      weekday: slot.weekday,
      startTime: timeLabel(slot.startTime),
      endTime: timeLabel(slot.endTime),
    })) ?? [{ weekday: "MONDAY", startTime: "", endTime: "" }],
  };
}
export function CandidateDialog({
  candidate,
  onClose,
  startAtAvailability = false,
}: {
  candidate?: Candidate;
  startAtAvailability?: boolean;
  onClose: () => void;
}): ReactElement {
  const [id] = useState(() => candidate?.id ?? crypto.randomUUID());
  const [draft, setDraft] = useState(() => initialDraft(candidate));
  const [step, setStep] = useState(startAtAvailability ? 1 : 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === 1) body.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [step, body]);
  const utils = trpc.useUtils();
  const router = useRouter();
  const save = trpc.admissions.save.useMutation({
    onSuccess: async () => {
      await utils.admissions.invalidate();
      onClose();
      if (!candidate) router.push(`/interessados/${id}`);
    },
  });
  function change<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => field !== key && !field.startsWith(`${key}.`)),
      ),
    );
    save.reset();
  }
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = admissionValuesSchema.safeParse({
      ...draft,
      availableUntil: parseDateBR(draft.availableUntil) ?? "",
    });
    const nextErrors = parsed.success
      ? {}
      : Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        );
    if (step === 0) {
      const contacts = Object.fromEntries(
        Object.entries(nextErrors).filter(([key]) => ["fullName", "phone", "email"].includes(key)),
      );
      if (Object.keys(contacts).length) {
        setErrors(contacts);
        setRevision((value) => value + 1);
        return;
      }
      setStep(1);
      return;
    }
    if (!parsed.success) {
      setErrors(nextErrors);
      setRevision((value) => value + 1);
      return;
    }
    save.mutate({ id, values: parsed.data });
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
            <DialogTitle>{candidate ? "Editar interesse" : "Novo interessado"}</DialogTitle>
            <DialogDescription>
              {step === 0 ? "1 de 2 · Pessoa e interesse" : "2 de 2 · Horários e nivelamento"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody ref={body}>
            <form id="candidate-form" noValidate onSubmit={submit} className="grid gap-5 pt-4">
              {step === 0 ? (
                <>
                  <FormSection title="Primeiro contato">
                    <Field>
                      <Label htmlFor="fullName">Nome completo</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        ref={first}
                        size="sm"
                        autoComplete="off"
                        placeholder="Nome do interessado"
                        value={draft.fullName}
                        invalid={Boolean(errors.fullName)}
                        onChange={(event) => change("fullName", event.target.value)}
                      />
                      <FieldError match={Boolean(errors.fullName)}>{errors.fullName}</FieldError>
                    </Field>
                    <FormRow columns={2}>
                      <TextControl
                        name="phone"
                        label="Telefone"
                        placeholder="(11) 99999-9999"
                        value={draft.phone ?? ""}
                        onChange={(value) => change("phone", maskPhoneBR(value))}
                        error={errors.phone}
                      />
                      <TextControl
                        name="email"
                        label="E-mail"
                        placeholder="nome@exemplo.com"
                        value={draft.email ?? ""}
                        onChange={(value) => change("email", value)}
                        error={errors.email}
                      />
                    </FormRow>
                  </FormSection>
                  <StudentLink
                    studentId={draft.studentId}
                    name={draft.fullName}
                    onChange={(value) => change("studentId", value)}
                  />
                  <FormSection title="O que procura">
                    <FormRow columns={2}>
                      <Field>
                        <Label>Modalidade</Label>
                        <SegmentedControl
                          size="sm"
                          aria-label="Modalidade"
                          value={draft.scheduleType}
                          onValueChange={(value) => {
                            if (value === "REGULAR" || value === "PERSONALIZED")
                              change("scheduleType", value);
                          }}
                        >
                          <SegmentedControlItem value="REGULAR">Regular</SegmentedControlItem>
                          <SegmentedControlItem value="PERSONALIZED">PPT</SegmentedControlItem>
                        </SegmentedControl>
                      </Field>
                      <Field>
                        <Label>Formato</Label>
                        <SegmentedControl
                          size="sm"
                          aria-label="Formato"
                          value={draft.format}
                          onValueChange={(value) => {
                            if (value === "IN_PERSON" || value === "ONLINE")
                              change("format", value);
                          }}
                        >
                          <SegmentedControlItem value="IN_PERSON">Presencial</SegmentedControlItem>
                          <SegmentedControlItem value="ONLINE">Online</SegmentedControlItem>
                        </SegmentedControl>
                      </Field>
                    </FormRow>
                  </FormSection>
                </>
              ) : (
                <>
                  <StageField
                    value={draft.stageId}
                    onChange={(value) => change("stageId", value)}
                    error={errors.stageId}
                  />
                  <FormSection
                    title="Disponibilidade semanal"
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          change("availability", [
                            ...draft.availability,
                            { weekday: "MONDAY", startTime: "", endTime: "" },
                          ])
                        }
                      >
                        <Plus />
                        Horário
                      </Button>
                    }
                  >
                    <p className="text-caption text-muted-foreground">
                      Informe os períodos em que a pessoa pode estudar.
                    </p>
                    {draft.availability.map((slot, index) => (
                      <AvailabilityRow
                        key={index}
                        index={index}
                        slot={slot}
                        errors={errors}
                        onChange={(value) =>
                          change(
                            "availability",
                            draft.availability.map((row, position) =>
                              position === index ? value : row,
                            ),
                          )
                        }
                        onRemove={
                          draft.availability.length > 1
                            ? () =>
                                change(
                                  "availability",
                                  draft.availability.filter((_, position) => position !== index),
                                )
                            : undefined
                        }
                      />
                    ))}
                    <div className="max-w-48">
                      <TextControl
                        name="availableUntil"
                        label="Horários confirmados até"
                        placeholder="dd/mm/aaaa"
                        inputMode="numeric"
                        value={draft.availableUntil}
                        onChange={(value) => change("availableUntil", maskDateBR(value))}
                        error={errors.availableUntil}
                      />
                    </div>
                  </FormSection>
                  <TextControl
                    name="notes"
                    label="Observações"
                    placeholder="Preferências, contato ou orientações de material"
                    value={draft.notes ?? ""}
                    onChange={(value) => change("notes", value)}
                  />
                </>
              )}
              {save.isError && <Alert variant="destructive">{save.error.message}</Alert>}
            </form>
          </DialogBody>
          <DialogFooter>
            {step === 1 ? (
              <Button
                variant="ghost"
                type="button"
                disabled={save.isPending}
                onClick={() => setStep(0)}
              >
                <ArrowLeft />
                Voltar
              </Button>
            ) : (
              <Button variant="ghost" type="button" onClick={onClose}>
                Cancelar
              </Button>
            )}
            <Button form="candidate-form" type="submit" disabled={save.isPending}>
              {save.isPending
                ? "Salvando…"
                : step === 0
                  ? "Continuar"
                  : candidate
                    ? "Salvar alterações"
                    : "Cadastrar interessado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
function StageField({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string | undefined;
}): ReactElement {
  const options = trpc.classes.formOptions.useQuery();
  const [query, setQuery] = useState("");
  const stages = options.data?.stages ?? [];
  const selected = stages.find((row) => row.id === value);
  return (
    <Field>
      <Label>Estágio indicado</Label>
      <SearchSelect
        name="stageId"
        placeholder="Buscar estágio após o nivelamento"
        query={query}
        value={selected ? { id: selected.id, label: selected.name } : null}
        options={stages
          .filter((row) =>
            row.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
          )
          .map((row) => ({ id: row.id, label: row.name }))}
        onQueryChange={setQuery}
        onSelect={(row) => {
          onChange(row.id);
          setQuery("");
        }}
        onClear={() => onChange(null)}
        openOnFocus
        invalid={Boolean(error)}
        emptyMessage="Nenhum estágio encontrado."
      />
      <p className="text-caption text-muted-foreground">
        O nivelamento é externo. Pode ser preenchido depois.
      </p>
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
function AvailabilityRow({
  slot,
  index,
  errors,
  onChange,
  onRemove,
}: {
  slot: Values["availability"][number];
  index: number;
  errors: Record<string, string>;
  onChange: (value: Values["availability"][number]) => void;
  onRemove?: (() => void) | undefined;
}): ReactElement {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_auto] items-end gap-2">
      <SelectControl
        name={`availability.${index}.weekday`}
        label="Dia"
        value={slot.weekday}
        choices={weekdays}
        onChange={(value) => onChange({ ...slot, weekday: value as typeof slot.weekday })}
      />
      <TextControl
        name={`availability.${index}.startTime`}
        label="Das"
        placeholder="08:00"
        inputMode="numeric"
        value={slot.startTime}
        onChange={(value) => onChange({ ...slot, startTime: maskTime24(value) })}
        error={errors[`availability.${index}.startTime`]}
      />
      <TextControl
        name={`availability.${index}.endTime`}
        label="Até"
        placeholder="12:00"
        inputMode="numeric"
        value={slot.endTime}
        onChange={(value) => onChange({ ...slot, endTime: maskTime24(value) })}
        error={errors[`availability.${index}.endTime`]}
      />
      {onRemove && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Remover horário ${index + 1}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
