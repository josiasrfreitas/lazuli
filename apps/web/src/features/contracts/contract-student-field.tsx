"use client";

import type { ReactElement } from "react";
import { Button, FormRow } from "@lazuli/ui";
import { UserMinus, UserPlus } from "lucide-react";
import { maskPhoneBR } from "~/lib/masks";
import type { FormProps } from "./contract-form-fields";
import { PartyPicker } from "./party-picker";
import { InlinePersonFields, PersonDocument } from "./contract-person-fields";
import { TextField } from "./contract-text-field";

type StudentProps = Pick<FormProps, "fields" | "errors" | "change">;

function GuardianFields({ fields, errors, change }: StudentProps): ReactElement {
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

export function ContractStudentField(props: StudentProps): ReactElement {
  const { fields, errors, change } = props;
  return (
    <div className="space-y-3">
      <FormRow columns={fields.studentMode === "create" ? 2 : 1}>
        <PartyPicker
          kind="student"
          createMode={fields.studentMode === "create"}
          draftName={fields.studentDraftName}
          value={
            fields.studentMode === "existing" && fields.studentId
              ? { id: fields.studentId, label: fields.studentName }
              : null
          }
          onChange={(option) => {
            if (option) change("studentMode", "existing");
            change("studentId", option?.id ?? "");
            change("studentName", option?.label ?? "");
          }}
          onClear={() => {
            change("studentMode", "existing");
            change("studentId", "");
            change("studentName", "");
          }}
          onSearchChange={(query) => change("studentDraftName", query)}
          onCreate={(query) => {
            change("studentMode", "create");
            change("studentDraftName", query.trim());
          }}
          error={fields.studentMode === "create" ? errors.studentDraftName : errors.studentId}
        />
        {fields.studentMode === "create" && <PersonDocument {...props} kind="student" />}
      </FormRow>
      {fields.studentMode === "create" && (
        <>
          <InlinePersonFields {...props} kind="student" />
          <GuardianFields {...props} />
        </>
      )}
    </div>
  );
}
