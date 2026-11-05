"use client";

import type { ReactElement, ReactNode } from "react";
import {
  Field,
  FieldError,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Switch,
  Textarea,
} from "@lazuli/ui";
import type { FormProps } from "./contract-form-fields";
import styles from "./contract-setup.module.css";

type ScholarshipProps = Pick<FormProps, "fields" | "errors" | "change"> & {
  material?: boolean;
  children?: ReactNode;
};

export function ContractScholarshipFields({
  fields,
  errors,
  change,
  material = false,
  children,
}: ScholarshipProps): ReactElement {
  const mode = material ? "materialScholarshipMode" : "scholarshipMode";
  const pct = material ? "materialScholarshipPct" : "scholarshipPct";
  const agreement = material ? "materialScholarshipAgreement" : "scholarshipAgreement";
  const title = material ? "Bolsa de material" : "Bolsa de mensalidade";
  const active = fields[mode] !== "NONE";
  return (
    <div className={styles.scholarship}>
      <div className={styles.scholarshipHeader} data-with-prices={Boolean(children)}>
        {children}
        <label className={styles.scholarshipToggle}>
          <Switch
            checked={active}
            onCheckedChange={(checked) => change(mode, checked ? "PARTIAL" : "NONE")}
          />
          <span>{title}</span>
        </label>
      </div>
      {active && (
        <ScholarshipDetails
          {...{ fields, errors, change, mode, pct, agreement, title, material }}
        />
      )}
    </div>
  );
}

type ScholarshipDetailsProps = Pick<ScholarshipProps, "fields" | "errors" | "change"> & {
  mode: "materialScholarshipMode" | "scholarshipMode";
  pct: "materialScholarshipPct" | "scholarshipPct";
  agreement: "materialScholarshipAgreement" | "scholarshipAgreement";
  title: string;
  material: boolean;
};

function ScholarshipDetails(props: ScholarshipDetailsProps): ReactElement {
  const { fields, errors, change, mode, pct, agreement, title, material } = props;
  return (
    <div className={styles.scholarshipDetails}>
      <div className={styles.scholarshipOptions}>
        <Field name={mode}>
          <Label>Tipo de bolsa</Label>
          <SegmentedControl
            size="sm"
            value={fields[mode]}
            aria-label={`Tipo de ${title.toLocaleLowerCase("pt-BR")}`}
            onValueChange={(value) => {
              if (value) change(mode, value);
            }}
          >
            <SegmentedControlItem value="PARTIAL">Parcial</SegmentedControlItem>
            <SegmentedControlItem value="FULL">Integral</SegmentedControlItem>
          </SegmentedControl>
        </Field>
        {fields[mode] === "PARTIAL" && <ScholarshipPercent {...{ fields, errors, change, pct }} />}
      </div>
      <Field name={agreement}>
        <Label>Acordo da bolsa</Label>
        <Textarea
          name={agreement}
          size="sm"
          autoComplete="off"
          placeholder="Condições acordadas para a bolsa"
          value={fields[agreement]}
          onChange={(event) => change(agreement, event.target.value)}
          invalid={Boolean(errors[agreement])}
          maxLength={5000}
          rows={2}
        />
        {errors[agreement] && <FieldError match>{errors[agreement]}</FieldError>}
      </Field>
      <p className={styles.scholarshipHelp}>
        {material
          ? "A bolsa se aplica aos livros desta aquisição."
          : "Válida durante o contrato. Não acumula desconto por pontualidade."}
      </p>
    </div>
  );
}

function ScholarshipPercent({
  fields,
  errors,
  change,
  pct,
}: Pick<ScholarshipDetailsProps, "fields" | "errors" | "change" | "pct">): ReactElement {
  return (
    <div className={styles.scholarshipPercent}>
      <Field name={pct}>
        <Label>Percentual (%)</Label>
        <Input
          name={pct}
          size="sm"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Ex.: 50"
          value={fields[pct]}
          onChange={(event) => change(pct, event.target.value)}
          invalid={Boolean(errors[pct])}
        />
        {errors[pct] && <FieldError match>{errors[pct]}</FieldError>}
      </Field>
    </div>
  );
}
