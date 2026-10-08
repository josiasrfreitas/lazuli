"use client";

import { useState, type ReactElement } from "react";
import { Copy } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { FormRow, type SearchSelectOption } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { FormProps } from "./contract-form-fields";
import { PartyPicker } from "./party-picker";
import { InlinePersonFields, PersonDocument } from "./contract-person-fields";

type PayerProps = Pick<FormProps, "fields" | "errors" | "change">;
type Source = {
  name: string;
  documentType?: string | null;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
};
type Profile = NonNullable<RouterOutputs["students"]["byId"]>;

function studentSource(fields: PayerProps["fields"], profile?: Profile): Source | null {
  if (fields.studentMode === "create")
    return {
      name: fields.studentDraftName,
      documentType: fields.studentDocumentType,
      documentNumber: fields.studentDocumentNumber,
      phone: fields.studentPhone,
      email: fields.studentEmail,
    };
  if (profile?.id !== fields.studentId || !profile.contact) return null;
  return { name: profile.contact.fullName, ...profile.contact };
}

function guardianSource(fields: PayerProps["fields"], profile?: Profile): Source | null {
  if (fields.studentMode === "create") {
    if (fields.studentGuardianMode !== "create") return null;
    return {
      name: fields.studentGuardianName,
      phone: fields.studentGuardianPhone,
      email: fields.studentGuardianEmail,
    };
  }
  if (profile?.id !== fields.studentId || !profile.guardian) return null;
  return { name: profile.guardian.fullName, ...profile.guardian };
}

function hasCompleteContact(source: Source): boolean {
  return Boolean(
    source.name.trim() &&
    source.documentType?.trim() &&
    source.documentNumber?.trim() &&
    source.phone?.trim() &&
    source.email?.trim(),
  );
}

function PayerCopyButton({
  fields,
  change,
  onCopyComplete,
}: Pick<PayerProps, "fields" | "change"> & { onCopyComplete: () => void }): ReactElement {
  const profile = trpc.students.byId.useQuery(
    { id: fields.studentId },
    { enabled: fields.studentMode === "existing" && Boolean(fields.studentId) },
  );
  const guardian = guardianSource(fields, profile.data);
  const student = studentSource(fields, profile.data);
  const source = guardian?.name.trim() ? guardian : student;
  const copySource = source?.name.trim() ? source : null;
  const fromGuardian = Boolean(guardian?.name.trim());
  const copy = (): void => {
    if (!copySource) return;
    change("payerMode", "create");
    change("payerId", "");
    change("payerLabel", "");
    change("payerName", copySource.name);
    change("payerDocumentType", copySource.documentType ?? "");
    change("payerDocumentNumber", copySource.documentNumber ?? "");
    change("payerPhone", copySource.phone ?? "");
    change("payerEmail", copySource.email ?? "");
    if (hasCompleteContact(copySource)) onCopyComplete();
  };
  return (
    <button
      aria-label={fromGuardian ? "Copiar responsável para pagador" : "Copiar aluno para pagador"}
      title={fromGuardian ? "Copiar responsável" : "Copiar aluno"}
      type="button"
      disabled={!copySource}
      onClick={copy}
      className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-disabled"
    >
      <Copy aria-hidden="true" className="size-4" />
    </button>
  );
}

function clearPayer(change: PayerProps["change"]): void {
  change("payerMode", "existing");
  change("payerId", "");
  change("payerLabel", "");
  change("payerName", "");
  change("payerDocumentType", "");
  change("payerDocumentNumber", "");
  change("payerPhone", "");
  change("payerEmail", "");
}

function payerTag(
  fields: PayerProps["fields"],
  copiedComplete: boolean,
): SearchSelectOption | null {
  if (!copiedComplete || fields.payerMode !== "create") return null;
  return { id: "copied-payer", label: fields.payerName, document: fields.payerDocumentNumber };
}

type PickerProps = PayerProps & {
  tag: SearchSelectOption | null;
  showCopy: boolean;
  setCopiedComplete: (complete: boolean) => void;
};

function PayerControl({
  fields,
  errors,
  change,
  tag,
  showCopy,
  setCopiedComplete,
}: PickerProps): ReactElement {
  const select = (option: SearchSelectOption | null): void => {
    setCopiedComplete(false);
    if (option) change("payerMode", "existing");
    change("payerId", option?.id ?? "");
    change("payerLabel", option?.label ?? "");
  };
  return (
    <PartyPicker
      kind="payer"
      createMode={fields.payerMode === "create"}
      draftName={fields.payerName}
      draftValue={tag}
      showAdornment={showCopy}
      endAdornment={
        <PayerCopyButton
          fields={fields}
          change={change}
          onCopyComplete={() => setCopiedComplete(true)}
        />
      }
      value={
        fields.payerMode === "existing" && fields.payerId
          ? { id: fields.payerId, label: fields.payerLabel }
          : null
      }
      onChange={select}
      onClear={() => {
        setCopiedComplete(false);
        clearPayer(change);
      }}
      onSearchChange={(query) => change("payerName", query)}
      onCreate={(query) => {
        setCopiedComplete(false);
        change("payerMode", "create");
        change("payerName", query.trim());
      }}
      error={fields.payerMode === "create" ? errors.payerName : errors.payerId}
    />
  );
}

export function ContractPayerFields({ fields, errors, change }: PayerProps): ReactElement {
  const [copiedComplete, setCopiedComplete] = useState(false);
  const tag = payerTag(fields, copiedComplete);
  const studentSelected =
    fields.studentMode === "create"
      ? Boolean(fields.studentDraftName.trim())
      : Boolean(fields.studentId);
  const showCopy = !tag && studentSelected && (fields.payerMode === "create" || !fields.payerId);
  const showDraftFields = fields.payerMode === "create" && !tag;
  return (
    <div className="space-y-3">
      <FormRow columns={showDraftFields ? 2 : 1}>
        <PayerControl {...{ fields, errors, change, tag, showCopy, setCopiedComplete }} />
        {showDraftFields && (
          <PersonDocument fields={fields} errors={errors} change={change} kind="payer" />
        )}
      </FormRow>
      {showDraftFields && (
        <InlinePersonFields fields={fields} errors={errors} change={change} kind="payer" />
      )}
    </div>
  );
}
