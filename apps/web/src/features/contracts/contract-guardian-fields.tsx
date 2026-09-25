"use client";

import type { ReactElement } from "react";
import { Button, FormRow } from "@lazuli/ui";
import { UserMinus, UserPlus } from "lucide-react";
import { maskPhoneBR } from "~/lib/masks";
import type { FormProps } from "./contract-form-fields";
import { TextField } from "./contract-text-field";

type GuardianProps = Pick<FormProps, "fields" | "errors" | "change">;

export function ContractGuardianFields({ fields, errors, change }: GuardianProps): ReactElement {
  const open = fields.studentGuardianMode === "create";
  const toggle = (): void => {
    change("studentGuardianMode", open ? "" : "create");
    if (!open) return;
    change("studentGuardianName", "");
    change("studentGuardianPhone", "");
    change("studentGuardianEmail", "");
  };
  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={toggle}>
        {open ? <UserMinus aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        {open ? "Remover responsável" : "Adicionar responsável"}
      </Button>
      {open && (
        <div className="space-y-3">
          <TextField
            name="studentGuardianName"
            label="Nome do responsável"
            placeholder="Nome completo do responsável"
            value={fields.studentGuardianName}
            error={errors.studentGuardianName}
            onChange={(value) => change("studentGuardianName", value)}
          />
          <FormRow columns={2}>
            <TextField
              name="studentGuardianPhone"
              label="Telefone (opcional)"
              placeholder="(00) 00000-0000"
              value={fields.studentGuardianPhone}
              error={errors.studentGuardianPhone}
              onChange={(value) => change("studentGuardianPhone", maskPhoneBR(value))}
            />
            <TextField
              name="studentGuardianEmail"
              label="Email (opcional)"
              placeholder="nome@exemplo.com"
              value={fields.studentGuardianEmail}
              error={errors.studentGuardianEmail}
              onChange={(value) => change("studentGuardianEmail", value)}
            />
          </FormRow>
        </div>
      )}
    </>
  );
}
