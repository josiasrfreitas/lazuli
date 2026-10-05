"use client";

import { useState, type ReactElement } from "react";
import { FormRow, type SearchSelectOption } from "@lazuli/ui";
import type { FormProps } from "./contract-form-fields";
import { PartyPicker } from "./party-picker";
import { InlinePersonFields, PersonDocument } from "./contract-person-fields";
import { PayerCopyButton } from "./contract-payer-copy";

type PayerProps = Pick<FormProps, "fields" | "errors" | "change">;

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
