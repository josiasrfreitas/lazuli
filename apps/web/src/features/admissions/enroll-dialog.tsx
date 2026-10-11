"use client";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
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
  FormRow,
  FormSection,
  Label,
  SearchSelect,
  SegmentedControl,
  SegmentedControlItem,
  type SearchSelectOption,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { maskDateBR, maskPhoneBR, parseDateBR } from "~/lib/masks";
import { TextControl } from "~/features/classes/form-controls";
import { isMinorOn } from "~/features/students/new-student/reducer";
import { dateLabel, type Candidate } from "./labels";

type Choice = RouterOutputs["admissions"]["matches"][number];
export function EnrollDialog({
  candidate,
  choice,
  date,
  onClose,
}: {
  candidate: Candidate;
  choice: Choice;
  date: string;
  onClose: () => void;
}): ReactElement {
  const [mode, setMode] = useState(candidate.student ? "existing" : "create");
  const [name, setName] = useState(candidate.fullName);
  const [birthDate, setBirthDate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [search, setSearch] = useState(candidate.fullName);
  const [student, setStudent] = useState<SearchSelectOption | null>(
    candidate.student ? { id: candidate.student.id, label: candidate.student.fullName } : null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const popup = useRef<HTMLDivElement>(null);
  const results = trpc.students.search.useQuery(
    { query: search || candidate.fullName },
    { enabled: mode === "existing" },
  );
  const utils = trpc.useUtils();
  const mutation = trpc.admissions.enroll.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admissions.invalidate(),
        utils.classes.invalidate(),
        utils.students.invalidate(),
      ]);
      onClose();
    },
  });
  const parsedBirth = parseDateBR(birthDate);
  const minor = isMinorOn({ birthDate: parsedBirth ?? "", today: candidate.today });
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (mutation.isPending) return;
    const next: Record<string, string> = {};
    if (mode === "existing" && !student) next.student = "Escolha o cadastro do aluno.";
    if (mode === "create") {
      if (!name.trim()) next.name = "Informe o nome.";
      if (birthDate && !parsedBirth) next.birthDate = "Data inválida.";
      if (parsedBirth && parsedBirth > candidate.today)
        next.birthDate = "A data não pode ser futura.";
      if (minor && !guardianName.trim()) next.guardianName = "Informe o responsável.";
      if (minor && !guardianPhone.trim()) next.guardianPhone = "Informe o contato do responsável.";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    mutation.mutate({
      id: candidate.id,
      classId: choice.id,
      date,
      student:
        mode === "existing"
          ? { mode: "existing", id: student!.id }
          : {
              mode: "create",
              values: {
                fullName: name.trim(),
                phone: candidate.phone,
                email: candidate.email,
                birthDate: parsedBirth ? new Date(parsedBirth) : null,
                ...(minor
                  ? {
                      guardian: {
                        mode: "create",
                        input: { fullName: guardianName.trim(), phone: guardianPhone },
                      },
                    }
                  : {}),
              },
            },
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          ref={popup}
          initialFocus={() => popup.current?.querySelector("input") ?? false}
        >
          <DialogHeader>
            <DialogTitle>Confirmar matrícula</DialogTitle>
            <DialogDescription>
              {choice.name} · Entrada em {dateLabel(date)}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form id="admission-enroll" noValidate className="grid gap-5 pt-4" onSubmit={submit}>
              {!candidate.student && (
                <SegmentedControl
                  size="sm"
                  aria-label="Cadastro do aluno"
                  value={mode}
                  onValueChange={(value) => {
                    if (value === "create" || value === "existing") setMode(value);
                    setErrors({});
                  }}
                >
                  <SegmentedControlItem value="create">Novo aluno</SegmentedControlItem>
                  <SegmentedControlItem value="existing">Já cadastrado</SegmentedControlItem>
                </SegmentedControl>
              )}
              {mode === "existing" ? (
                <Field>
                  <Label>Aluno</Label>
                  <SearchSelect
                    name="student"
                    placeholder="Buscar aluno pelo nome"
                    query={search}
                    value={student}
                    options={(results.data ?? []).map((row) => ({
                      id: row.id,
                      label: row.fullName,
                    }))}
                    onQueryChange={setSearch}
                    onSelect={setStudent}
                    onClear={() => setStudent(null)}
                    invalid={Boolean(errors.student)}
                    disabled={Boolean(candidate.student)}
                    openOnFocus
                  />
                  {errors.student && (
                    <p className="text-caption text-destructive">{errors.student}</p>
                  )}
                </Field>
              ) : (
                <FormSection title="Cadastro do aluno">
                  <TextControl
                    name="name"
                    label="Nome completo"
                    placeholder="Nome completo do aluno"
                    value={name}
                    onChange={(value) => {
                      setName(value);
                      setErrors({});
                    }}
                    error={errors.name}
                  />
                  <div className="w-44">
                    <TextControl
                      name="birthDate"
                      label="Data de nascimento"
                      placeholder="dd/mm/aaaa"
                      inputMode="numeric"
                      value={birthDate}
                      onChange={(value) => {
                        setBirthDate(maskDateBR(value));
                        setErrors({});
                      }}
                      error={errors.birthDate}
                    />
                  </div>
                  <p className="text-caption text-muted-foreground">
                    Telefone e e-mail serão aproveitados do interesse registrado.
                  </p>
                </FormSection>
              )}
              {mode === "create" && minor && (
                <FormSection title="Responsável pelo menor">
                  <FormRow columns={2}>
                    <TextControl
                      name="guardianName"
                      label="Nome do responsável"
                      placeholder="Nome completo"
                      value={guardianName}
                      onChange={(value) => {
                        setGuardianName(value);
                        setErrors({});
                      }}
                      error={errors.guardianName}
                    />
                    <TextControl
                      name="guardianPhone"
                      label="Telefone do responsável"
                      placeholder="(11) 99999-9999"
                      value={guardianPhone}
                      onChange={(value) => {
                        setGuardianPhone(maskPhoneBR(value));
                        setErrors({});
                      }}
                      error={errors.guardianPhone}
                    />
                  </FormRow>
                </FormSection>
              )}
              <Alert variant="neutral">
                A matrícula inicia o vínculo com a turma e o estágio. Contrato e cobranças são
                tratados separadamente.
              </Alert>
              {mutation.isError && <Alert variant="destructive">{mutation.error.message}</Alert>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" disabled={mutation.isPending} onClick={onClose}>
              Voltar
            </Button>
            <Button form="admission-enroll" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Matriculando…" : "Confirmar matrícula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
