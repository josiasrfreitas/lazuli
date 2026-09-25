"use client";

import type { ReactElement } from "react";
import { FormRow } from "@lazuli/ui";
import type { FormProps } from "./contract-form-fields";
import { PartyPicker } from "./party-picker";
import { InlinePersonFields, PersonDocument } from "./contract-person-fields";
import { PayerCopyButton } from "./contract-payer-copy";

type PayerProps = Pick<FormProps, "fields" | "errors" | "change">;

export function ContractPayerFields(props: PayerProps): ReactElement {
  const { fields, errors, change } = props;
  const studentSelected =
    fields.studentMode === "create"
      ? Boolean(fields.studentDraftName.trim())
      : Boolean(fields.studentId);
  const showCopy = studentSelected && (fields.payerMode === "create" || !fields.payerId);
  return (
    <div className="space-y-3">
      <FormRow columns={fields.payerMode === "create" ? 2 : 1}>
        <PartyPicker
          kind="payer"
          createMode={fields.payerMode === "create"}
          draftName={fields.payerName}
          showAdornment={showCopy}
          endAdornment={<PayerCopyButton fields={fields} change={change} />}
          value={
            fields.payerMode === "existing" && fields.payerId
              ? { id: fields.payerId, label: fields.payerLabel }
              : null
          }
          onChange={(option) => {
            if (option) change("payerMode", "existing");
            change("payerId", option?.id ?? "");
            change("payerLabel", option?.label ?? "");
          }}
          onClear={() => {
            change("payerMode", "existing");
            change("payerId", "");
            change("payerLabel", "");
          }}
          onSearchChange={(query) => change("payerName", query)}
          onCreate={(query) => {
            change("payerMode", "create");
            change("payerName", query.trim());
          }}
          error={fields.payerMode === "create" ? errors.payerName : errors.payerId}
        />
        {fields.payerMode === "create" && <PersonDocument {...props} kind="payer" />}
      </FormRow>
      {fields.payerMode === "create" && <InlinePersonFields {...props} kind="payer" />}
    </div>
  );
}
