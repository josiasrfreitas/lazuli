"use client";
import type { ReactElement } from "react";
import { Field, Label, FormRow, SelectionValue } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";

export function ContractSelectedStudent({
  id,
  name,
  onClear,
}: {
  id: string;
  name: string;
  onClear: () => void;
}): ReactElement {
  const profile = trpc.students.byId.useQuery({ id });
  const contact = profile.data?.contact;
  const values = [
    ["CPF ou RG", contact?.documentNumber],
    ["Nascimento", contact?.birthDate ? formatDateOnlyBR(contact.birthDate) : ""],
    ["Telefone", contact?.phone],
    ["E-mail", contact?.email],
  ];
  return (
    <div className="grid gap-3">
      <Field>
        <Label>Aluno</Label>
        <SelectionValue value={name} onClear={onClear} clearLabel="Limpar aluno e seus dados" />
      </Field>
      <FormRow columns={2}>
        {values.map(([label, value]) => (
          <Field key={label}>
            <Label>{label}</Label>
            <SelectionValue value={value || (profile.isFetching ? "Carregando…" : "")} />
          </Field>
        ))}
      </FormRow>
    </div>
  );
}
