"use client";

import type { ReactElement } from "react";
import { Button, ToastAlert } from "@lazuli/ui";
import { formatBRLFromCents as money } from "~/lib/format";
import type { FormProps } from "./contract-form-fields";
import type { SetupMaterial } from "./contract-setup-material";
import { MaterialAgreedPrice } from "./material-agreed-price";
import { MaterialCardFeeField } from "./material-card-fee-field";
import { materialCardFeeLabel, selectedMaterialCardFee } from "./material-card-fee";
import { materialPaymentLabel } from "./material-payment-label";
import styles from "./contract-material.module.css";

type Props = Pick<FormProps, "fields"> & {
  material: SetupMaterial;
  change?: FormProps["change"] | undefined;
  errors?: FormProps["errors"] | undefined;
};

export function MaterialQuoteSummary(props: Props): ReactElement {
  const { material } = props;
  if (material.count === 0)
    return <QuotePrompt>Selecione um livro para calcular o valor.</QuotePrompt>;
  if (material.prices.isPending) return <QuotePrompt>Carregando os preços…</QuotePrompt>;
  if (material.prices.isError)
    return (
      <ToastAlert variant="destructive">
        Não foi possível carregar os preços.{" "}
        <Button type="button" variant="link" onClick={() => void material.prices.refetch()}>
          Tentar novamente
        </Button>
      </ToastAlert>
    );
  if (!material.prices.data)
    return <ToastAlert variant="warning">Cadastre os preços do material em Ajustes.</ToastAlert>;
  if (material.referenceCents === null)
    return <QuotePrompt>Escolha a tabela de preços: infantil ou adulto.</QuotePrompt>;
  return <MaterialQuoteBody {...props} referenceCents={material.referenceCents} />;
}

function MaterialQuoteBody({
  fields,
  material,
  change,
  errors,
  referenceCents,
}: Props & { referenceCents: number }): ReactElement {
  return (
    <div className={styles.quote}>
      {change && <MaterialQuoteEditors {...{ fields, material, change, errors, referenceCents }} />}
      <MaterialBreakdown fields={fields} material={material} change={change} />
      <div className={styles.total} aria-live="polite" aria-atomic="true">
        <div>
          <span>Total a pagar</span>
          <strong>{material.effective ? money(material.effective.chargedCents) : "—"}</strong>
        </div>
        <p className={styles.payment}>{materialChargeLabel(fields, material)}</p>
      </div>
      <p className={styles.help}>Cobrado separadamente das mensalidades.</p>
    </div>
  );
}

function MaterialQuoteEditors({
  fields,
  material,
  change,
  errors,
  referenceCents,
}: Props & {
  change: FormProps["change"];
  referenceCents: number;
}): ReactElement {
  const card =
    fields.materialPayment === "INSTALLMENTS" && fields.materialScholarshipMode !== "FULL";
  const feeError = fields.materialCardFeeMode === "CUSTOM" ? errors?.materialCardFeePct : undefined;
  return (
    <>
      <MaterialAgreedPrice
        fields={fields}
        change={change}
        referenceCents={referenceCents}
        error={errors?.materialCustomPrice || material.priceError}
      />
      {card && (
        <MaterialCardFeeField
          fields={fields}
          change={change}
          defaultRate={
            material.prices.data?.cardFeeRates[String(Number(fields.materialInstallments))]
          }
          error={feeError || material.feeError}
        />
      )}
    </>
  );
}

function MaterialBreakdown({ fields, material, change }: Props): ReactElement | null {
  const effective = material.effective;
  if (!effective) return null;
  const card =
    fields.materialPayment === "INSTALLMENTS" && fields.materialScholarshipMode !== "FULL";
  const rate = selectedMaterialCardFee(fields, material.prices.data?.cardFeeRates);
  if (!card && fields.materialScholarshipMode === "NONE") return null;
  return (
    <dl className={styles.breakdown}>
      {fields.materialScholarshipMode !== "NONE" && (
        <div>
          <dt>Preço com bolsa</dt>
          <dd>{money(effective.receivableCents)}</dd>
        </div>
      )}
      {card && (
        <div>
          <dt>
            Taxa incluída{change || rate === undefined ? "" : ` (${materialCardFeeLabel(rate)})`}
          </dt>
          <dd>{money(effective.feeCents)}</dd>
        </div>
      )}
    </dl>
  );
}

function materialChargeLabel(fields: Props["fields"], material: SetupMaterial): string {
  if (!material.effective) return "Revise os valores para calcular o total.";
  if (fields.materialScholarshipMode === "FULL") return "Bolsa integral · sem cobrança";
  if (fields.materialPayment === "CASH") return "À vista · pagamento único";
  if (!material.plan) return "Informe uma quantidade válida de parcelas.";
  return `${materialPaymentLabel(material.effective.chargedCents, material.plan.installmentCount)} no cartão`;
}

function QuotePrompt({ children }: { children: string }): ReactElement {
  return (
    <p role="status" className={styles.help}>
      {children}
    </p>
  );
}
