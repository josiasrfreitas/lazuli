"use client";

import type { ReactElement } from "react";
import { Field, FieldError, Input, Label, Textarea } from "@lazuli/ui";
import type { FormProps } from "./contract-form-fields";

type ScholarshipProps = Pick<FormProps, "fields" | "errors" | "change"> & {
  material?: boolean;
};

export function ContractScholarshipFields({
  fields,
  errors,
  change,
  material = false,
}: ScholarshipProps): ReactElement {
  const mode = material ? "materialScholarshipMode" : "scholarshipMode";
  const pct = material ? "materialScholarshipPct" : "scholarshipPct";
  const agreement = material ? "materialScholarshipAgreement" : "scholarshipAgreement";
  const title = material ? "Bolsa de material" : "Bolsa de mensalidade";
  const scholarship = fields[mode] !== "NONE";
  return (
    <div className="grid min-w-0 gap-3">
      <Field name={pct} className="max-w-56">
        <Label>{title} (%)</Label>
        <Input
          name={pct}
          size="sm"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Sem bolsa · 100 = integral"
          value={fields[mode] === "FULL" ? "100" : fields[pct]}
          onChange={(event) => {
            const value = event.target.value;
            const percent = Number(value.replace(",", "."));
            change(pct, value);
            change(
              mode,
              value.trim() === "" || percent === 0 ? "NONE" : percent === 100 ? "FULL" : "PARTIAL",
            );
          }}
          invalid={Boolean(errors[pct])}
        />
        {errors[pct] && <FieldError match>{errors[pct]}</FieldError>}
      </Field>
      {scholarship && (
        <Field name={agreement}>
          <Label>Acordo da bolsa</Label>
          <Textarea
            name={agreement}
            autoComplete="off"
            placeholder="Descreva como a bolsa foi acordada e suas condições."
            value={fields[agreement]}
            onChange={(event) => change(agreement, event.target.value)}
            invalid={Boolean(errors[agreement])}
            maxLength={5000}
            rows={2}
          />
          {errors[agreement] && <FieldError match>{errors[agreement]}</FieldError>}
          <p className="text-caption text-muted-foreground">
            {material
              ? "A bolsa se aplica aos livros desta aquisição."
              : "Válida durante o contrato. Não acumula desconto por pontualidade."}
          </p>
        </Field>
      )}
    </div>
  );
}
