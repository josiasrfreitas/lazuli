"use client";

import { type ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import { formatBRLFromCents as money } from "~/lib/format";
import type { FormProps } from "./contract-form-fields";
import type { SetupMaterial } from "./contract-setup-material";
import { setupPlanLabel, type SetupStep } from "./contract-setup-model";
import styles from "./contract-setup.module.css";
const CENTS_PER_REAL = 100;

type SummaryRow = {
  step: SetupStep;
  title: string;
  value: string;
  detail?: string | undefined;
};

function materialValue(fields: FormProps["fields"], material: SetupMaterial): string {
  if (fields.materialPayment === "NONE") return "Sem nova aquisição";
  if (!material.effective) return "Livros e valores a definir";
  const books = material.count === 1 ? "livro" : "livros";
  return `${material.count} ${books} · ${money(material.effective.chargedCents)}`;
}

function materialDetail(fields: FormProps["fields"]): string | undefined {
  if (fields.materialPayment === "NONE") return undefined;
  if (fields.materialScholarshipMode === "FULL") return "Bolsa integral";
  if (fields.materialPayment === "CASH") return "À vista · repasse";
  return `${fields.materialInstallments || "—"} parcelas · cartão · repasse`;
}

function summaryRows({
  fields,
  preview,
  material,
}: {
  fields: FormProps["fields"];
  preview: FormProps["preview"];
  material: SetupMaterial;
}): SummaryRow[] {
  const payer = fields.payerMode === "create" ? fields.payerName : fields.payerLabel;
  const fee = Math.round(Number(fields.enrollmentFee.replace(",", ".")) * CENTS_PER_REAL);
  return [
    {
      step: "parties",
      title: "Responsável e período",
      value: payer || "Responsável a definir",
      detail:
        fields.firstDueDate && fields.endsOn
          ? `${fields.firstDueDate} a ${fields.endsOn}`
          : "Período a definir",
    },
    {
      step: "tuition",
      title: "Mensalidades",
      value: setupPlanLabel(preview),
      detail: fee > 0 ? `Matrícula ${money(fee)}` : "Sem taxa de matrícula",
    },
    {
      step: "material",
      title: "Material",
      value: materialValue(fields, material),
      detail: materialDetail(fields),
    },
    { step: "review", title: "Conferência", value: "Revisar o combinado" },
  ];
}

export function SetupSummary({
  fields,
  preview,
  material,
  step,
  onEdit,
  pending,
}: Pick<FormProps, "fields" | "preview"> & {
  material: SetupMaterial;
  step: SetupStep;
  onEdit: (step: SetupStep) => void;
  pending: boolean;
}): ReactElement {
  const rows = summaryRows({ fields, preview, material });
  return (
    <nav aria-label="Assuntos do contrato">
      <ol className={styles.summaryList}>
        {rows.map((row) => (
          <li key={row.step}>
            <button
              type="button"
              disabled={pending}
              aria-current={step === row.step ? "step" : undefined}
              onClick={() => onEdit(row.step)}
              className={styles.summaryItem}
            >
              <span className={styles.summaryLabel}>
                {row.title}
                <ChevronRight aria-hidden="true" />
              </span>
              <span className={styles.summaryValue}>{row.value}</span>
              {row.detail && <span className={styles.summaryDetail}>{row.detail}</span>}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
