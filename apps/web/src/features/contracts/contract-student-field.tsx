"use client";

import type { ReactElement } from "react";
import { FormRow } from "@lazuli/ui";
import type { FormProps } from "./contract-form-fields";
import { PartyPicker } from "./party-picker";
import { InlinePersonFields, PersonDocument } from "./contract-person-fields";
import { ContractGuardianFields } from "./contract-guardian-fields";

type StudentProps = Pick<FormProps, "fields" | "errors" | "change">;

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
          <ContractGuardianFields {...props} />
        </>
      )}
    </div>
  );
}
