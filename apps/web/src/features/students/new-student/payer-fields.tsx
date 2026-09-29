import { useState, type ReactElement } from "react";
import { Button, FormRow, FormSection, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import type { FormProps } from "../../contracts/contract-form-fields";
import { InlinePersonFields, PersonDocument } from "../../contracts/contract-person-fields";
import { PartyPicker } from "../../contracts/party-picker";
import { TextField } from "../../contracts/contract-text-field";
import { payerFieldsFromStudent } from "./finance-model";
import type { NewStudentFields } from "./reducer";

type Props = Pick<FormProps, "fields" | "errors" | "change"> & { student: NewStudentFields };

function CopyActions({
  student,
  copy,
}: {
  student: NewStudentFields;
  copy: (source: "student" | "guardian") => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={() => copy("student")}>
        Copiar aluno
      </Button>
      {student.guardianName.trim() && (
        <Button type="button" variant="secondary" size="sm" onClick={() => copy("guardian")}>
          Copiar responsável
        </Button>
      )}
    </div>
  );
}

function NewPayerFields(props: Props): ReactElement {
  const { fields, errors, change, student } = props;
  const [contactsOpen, setContactsOpen] = useState(Boolean(fields.payerPhone || fields.payerEmail));
  const showContacts = contactsOpen || Boolean(errors.payerPhone || errors.payerEmail);
  const copy = (source: "student" | "guardian"): void => {
    const copied = payerFieldsFromStudent(student, source);
    setContactsOpen(Boolean(copied.payerPhone || copied.payerEmail));
    for (const [key, value] of Object.entries(copied)) {
      change(key as keyof Props["fields"], value);
    }
  };
  return (
    <>
      <CopyActions student={student} copy={copy} />
      <TextField
        name="payerName"
        label="Nome do pagador"
        placeholder="Nome completo do pagador"
        value={fields.payerName}
        error={errors.payerName}
        onChange={(value) => change("payerName", value)}
      />
      <PersonDocument {...props} kind="payer" />
      <FormSection
        title="Contato"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={showContacts}
            onClick={() => setContactsOpen(!showContacts)}
          >
            {showContacts ? "Recolher" : "Adicionar"}
          </Button>
        }
      >
        {showContacts && <InlinePersonFields {...props} kind="payer" />}
      </FormSection>
    </>
  );
}

export function WizardPayerFields(props: Props): ReactElement {
  const { fields, errors, change } = props;
  return (
    <FormSection title="Pagador">
      <SegmentedControl
        aria-label="Cadastro do pagador"
        size="sm"
        value={fields.payerMode}
        onValueChange={(value) => {
          if (value) change("payerMode", value);
        }}
      >
        <SegmentedControlItem value="create">Novo pagador</SegmentedControlItem>
        <SegmentedControlItem value="existing">Já cadastrado</SegmentedControlItem>
      </SegmentedControl>
      {fields.payerMode === "create" ? (
        <NewPayerFields {...props} />
      ) : (
        <FormRow>
          <PartyPicker
            kind="payer"
            value={fields.payerId ? { id: fields.payerId, label: fields.payerLabel } : null}
            onChange={(option) => {
              change("payerId", option?.id ?? "");
              change("payerLabel", option?.label ?? "");
            }}
            onClear={() => {
              change("payerId", "");
              change("payerLabel", "");
            }}
            onSearchChange={() => {}}
            onCreate={(query) => {
              change("payerMode", "create");
              change("payerName", query.trim());
            }}
            error={errors.payerId}
          />
        </FormRow>
      )}
    </FormSection>
  );
}
