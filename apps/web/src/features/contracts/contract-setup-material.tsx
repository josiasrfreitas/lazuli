"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { BookOpen } from "lucide-react";
import {
  materialPriceQuote,
  materialScholarshipQuote,
  materialInstallmentPlan,
} from "@lazuli/domain";
import {
  Alert,
  Button,
  Field,
  FieldError,
  FormSection,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money } from "~/lib/format";
import type { FormProps } from "./contract-form-fields";
import {
  materialInstallmentCount,
  materialPriceInput,
  scholarshipInput,
} from "./contract-form-model";
import { MaterialStages } from "./material-book-fields";
import { ContractScholarshipFields } from "./contract-scholarship-fields";
import { MaterialAgreedPrice } from "./material-agreed-price";
import { materialPaymentLabel } from "./material-payment-label";
import styles from "./contract-setup.module.css";

type MaterialProps = Pick<FormProps, "fields" | "errors" | "change">;

export function useSetupMaterial({
  fields,
  change,
  suggestedStageId,
}: Pick<MaterialProps, "fields" | "change"> & { suggestedStageId?: string | null | undefined }) {
  const enabled = fields.materialPayment !== "NONE";
  const prices = trpc.finance.readMaterialPrice.useQuery();
  const status = trpc.finance.studentMaterials.useQuery(
    { studentId: fields.studentId },
    { enabled: Boolean(fields.studentId) },
  );
  const stages = trpc.finance.contractMaterialOptions.useQuery();
  const suggested = suggestedStageId ?? status.data?.suggestedStageId;
  const appliedSuggestion = useRef<string | null>(null);
  useEffect(() => {
    const stage = stages.data?.find((item) => item.id === suggested);
    if (!stage || appliedSuggestion.current === stage.id) return;
    const previous = appliedSuggestion.current;
    appliedSuggestion.current = stage.id;
    if (fields.materialStageIds && fields.materialStageIds !== previous) return;
    change("materialStageIds", stage.id);
    if (!fields.materialCategory)
      change("materialCategory", stage.track.ageGroup === "CHILD" ? "CHILD" : "ADULT");
  }, [suggested, stages.data, fields.materialStageIds, fields.materialCategory, change]);
  const count = fields.materialStageIds.split(",").filter(Boolean).length;
  const unit =
    fields.materialCategory === "CHILD"
      ? prices.data?.child
      : fields.materialCategory === "ADULT"
        ? prices.data?.adult
        : undefined;
  const quote =
    enabled && unit && prices.data && count > 0
      ? materialPriceQuote({
          installments: unit.installments * count,
          installmentCents: unit.installmentCents,
          cardFeePct: prices.data.cardFeePct,
        })
      : null;
  let priceError = "";
  const override = materialPriceInput(fields).priceOverrideCents;
  if (
    override !== undefined &&
    (!Number.isInteger(override) || override < 1 || override > 2147483647)
  )
    priceError = "Informe um valor válido maior que zero.";
  let effective: ReturnType<typeof materialScholarshipQuote> | null = null;
  try {
    if (quote && prices.data)
      effective = materialScholarshipQuote({
        quote,
        ...materialPriceInput(fields),
        payment: fields.materialPayment === "CASH" ? "CASH" : "INSTALLMENTS",
        scholarshipPct: scholarshipInput(fields, true).scholarshipPct ?? 0,
        cardFeePct: prices.data.cardFeePct,
      });
  } catch {
    /* Invalid scholarships are reported beside their fields. */
  }
  const total = quote
    ? String(fields.materialPayment === "CASH" ? quote.cashCents : quote.totalCents)
    : "";
  const version = enabled ? (unit?.version ?? "") : "";
  useEffect(() => {
    if (fields.materialQuoteVersion !== version) change("materialQuoteVersion", version);
    if (fields.materialTotal !== total) change("materialTotal", total);
  }, [change, fields.materialQuoteVersion, fields.materialTotal, total, version]);
  let plan: ReturnType<typeof materialInstallmentPlan> | null = null;
  let installmentError = "";
  if (effective) {
    try {
      plan = materialInstallmentPlan(effective.chargedCents, materialInstallmentCount(fields));
    } catch (cause) {
      installmentError =
        cause instanceof Error ? cause.message : "Confira a quantidade de parcelas.";
    }
  }
  return { prices, stages, quote, effective, count, plan, installmentError, status, priceError };
}

export type SetupMaterial = ReturnType<typeof useSetupMaterial>;

export function SetupScholarship(props: MaterialProps & { material?: boolean }): ReactElement {
  const active = props.material
    ? props.fields.materialScholarshipMode !== "NONE"
    : props.fields.scholarshipMode !== "NONE";
  const error = props.material
    ? props.errors.materialScholarshipPct || props.errors.materialScholarshipAgreement
    : props.errors.scholarshipPct || props.errors.scholarshipAgreement;
  return (
    <details className={styles.disclosure} open={active || error ? true : undefined}>
      <summary>
        {props.material ? "Bolsa do material" : "Bolsa de mensalidade"}
        <span>Opcional</span>
      </summary>
      <div className={styles.disclosureBody}>
        <ContractScholarshipFields {...props} />
      </div>
    </details>
  );
}

export function SetupMaterialFields({
  fields,
  errors,
  change,
  material,
  allowNoAcquisition = false,
}: MaterialProps & {
  material: SetupMaterial;
  suggestedStageId?: string | null | undefined;
  allowNoAcquisition?: boolean;
}): ReactElement {
  const enabled = !allowNoAcquisition || fields.materialPayment !== "NONE";
  const chooseAcquisition = (value: string | null): void => {
    if (value) change("materialPayment", value === "NONE" ? "NONE" : "CASH");
  };
  return (
    <div className={styles.materialFields}>
      {allowNoAcquisition && (
        <Field name="materialAcquisition">
          <Label>Material neste contrato</Label>
          <SegmentedControl
            size="sm"
            wrap
            value={enabled ? "BUY" : "NONE"}
            onValueChange={chooseAcquisition}
            aria-label="Material neste contrato"
          >
            <SegmentedControlItem value="NONE">Sem nova aquisição</SegmentedControlItem>
            <SegmentedControlItem value="BUY">Adquirir material</SegmentedControlItem>
          </SegmentedControl>
        </Field>
      )}
      {allowNoAcquisition && <PreviousMaterial material={material} />}
      <fieldset disabled={!enabled} className="grid min-w-0 gap-3 disabled:opacity-50">
        <FormSection title="Livros desta aquisição">
          <div
            aria-invalid={Boolean(errors.materialStageIds)}
            tabIndex={-1}
            data-invalid-book={
              errors.materialStageIds
                ? fields.materialStageIds.split(",").findIndex((id) => !id)
                : undefined
            }
          >
            <MaterialStages
              fields={fields}
              errors={errors}
              change={change}
              options={material.stages.data}
              pending={material.stages.isPending}
              failed={material.stages.isError}
              retry={() => void material.stages.refetch()}
            />
          </div>
          {material.stages.data?.length === 0 && (
            <p role="status" className={styles.help}>
              Não há livros disponíveis no catálogo.
            </p>
          )}
        </FormSection>
        <div className={styles.materialTerms}>
          <Field name="materialCategory">
            <Label>Faixa de preço</Label>
            <SegmentedControl
              size="sm"
              className="w-full"
              value={fields.materialCategory || null}
              onValueChange={(value) => {
                if (value) change("materialCategory", value);
              }}
              invalid={Boolean(errors.materialCategory)}
              aria-label="Faixa de preço"
            >
              <SegmentedControlItem className="flex-1" value="CHILD">
                Infantil
              </SegmentedControlItem>
              <SegmentedControlItem className="flex-1" value="ADULT">
                Adulto
              </SegmentedControlItem>
            </SegmentedControl>
            {errors.materialCategory && <FieldError match>{errors.materialCategory}</FieldError>}
          </Field>
          <Field name="materialPayment">
            <Label>Pagamento do material</Label>
            <SegmentedControl
              size="sm"
              className="w-full"
              value={fields.materialPayment}
              onValueChange={(value) => {
                if (value) change("materialPayment", value);
              }}
              aria-label="Pagamento do material"
            >
              <SegmentedControlItem className="flex-1" value="CASH">
                À vista
              </SegmentedControlItem>
              <SegmentedControlItem className="flex-1" value="INSTALLMENTS">
                Cartão
              </SegmentedControlItem>
            </SegmentedControl>
          </Field>
          <Field name="materialInstallments" className="max-w-40">
            <Label>Parcelas</Label>
            <Input
              name="materialInstallments"
              size="sm"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="6"
              autoComplete="off"
              disabled={
                fields.materialPayment !== "INSTALLMENTS" ||
                fields.materialScholarshipMode === "FULL"
              }
              value={
                fields.materialPayment === "INSTALLMENTS" &&
                fields.materialScholarshipMode !== "FULL"
                  ? fields.materialInstallments
                  : "1"
              }
              onChange={(event) => change("materialInstallments", event.target.value)}
              aria-invalid={Boolean(errors.materialInstallments || material.installmentError)}
            />
            {(errors.materialInstallments || material.installmentError) && (
              <FieldError match>
                {errors.materialInstallments || material.installmentError}
              </FieldError>
            )}
          </Field>
        </div>
        <SetupScholarship fields={fields} errors={errors} change={change} material />
        {enabled && (
          <MaterialQuoteSummary
            fields={fields}
            material={material}
            change={change}
            errors={errors}
          />
        )}
        {errors.materialTotal && (
          <p
            role="alert"
            tabIndex={-1}
            aria-invalid="true"
            className="text-caption text-destructive"
          >
            {errors.materialTotal}
          </p>
        )}
      </fieldset>
    </div>
  );
}

export function MaterialQuoteSummary({
  fields,
  material,
  change,
  errors,
}: Pick<MaterialProps, "fields"> &
  Partial<Pick<MaterialProps, "change" | "errors">> & { material: SetupMaterial }): ReactElement {
  if (material.count === 0)
    return <MaterialQuotePrompt message="Escolha o livro para ver o resumo da aquisição." />;
  if (material.prices.isPending)
    return (
      <p role="status" className={styles.help}>
        Carregando o preço do material…
      </p>
    );
  if (material.prices.isError)
    return (
      <Alert variant="destructive">
        Não foi possível carregar o preço.{" "}
        <Button type="button" variant="link" onClick={() => void material.prices.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (!material.prices.data)
    return <Alert variant="warning">Configure os preços do material em Ajustes.</Alert>;
  if (!material.quote)
    return (
      <MaterialQuotePrompt message="Escolha a faixa de preço para ver o resumo da aquisição." />
    );
  const { effective, plan } = material;
  return (
    <div className={styles.materialTotal} aria-live="polite">
      {change ? (
        <MaterialAgreedPrice
          fields={fields}
          change={change}
          referenceCents={
            fields.materialPayment === "CASH" ? material.quote.cashCents : material.quote.totalCents
          }
          error={errors?.materialCustomPrice || material.priceError || undefined}
        />
      ) : (
        <div>
          <span>Total do material</span>
          <strong>{effective ? money(effective.chargedCents) : "—"}</strong>
        </div>
      )}
      {change && fields.materialScholarshipMode !== "NONE" && effective && (
        <div>
          <span>Com bolsa</span>
          <strong>{money(effective.chargedCents)}</strong>
        </div>
      )}
      {effective && (
        <p>
          {fields.materialScholarshipMode === "FULL"
            ? "Bolsa integral · aquisição sem cobrança"
            : fields.materialPayment === "CASH"
              ? "À vista, em um único pagamento"
              : plan
                ? `${materialPaymentLabel(effective.chargedCents, plan.installmentCount)} no cartão`
                : "Informe o parcelamento do total desta aquisição"}
        </p>
      )}
      {fields.materialPayment === "INSTALLMENTS" && effective && effective.chargedCents > 0 && (
        <p>
          Taxa do cartão {money(effective.feeCents)} · líquido a receber{" "}
          {money(effective.receivableCents)}
        </p>
      )}
      <p className={styles.help}>Material é repasse, separado das mensalidades.</p>
    </div>
  );
}

function MaterialQuotePrompt({ message }: { message: string }): ReactElement {
  return (
    <div className={styles.materialQuotePrompt} role="status">
      <span className={styles.materialQuotePromptIcon}>
        <BookOpen aria-hidden="true" />
      </span>
      <p>{message}</p>
    </div>
  );
}

function PreviousMaterial({ material }: { material: SetupMaterial }): ReactElement | null {
  const status = material.status.data;
  if (!status) return null;
  const last = status.acquisitions[0];
  return (
    <div className="grid gap-1 text-caption text-muted-foreground">
      <p>
        {status.acquiredCount}{" "}
        {status.acquiredCount === 1 ? "livro já adquirido" : "livros já adquiridos"}
        {status.current.length > 0
          ? ` · Atual: ${status.current.map((book) => book.name).join(", ")}`
          : ""}
      </p>
      {last && (
        <p>
          Última aquisição: {last.books.map((book) => book.name).join(" + ")} ·{" "}
          {last.chargedCents === 0
            ? "Bolsa integral"
            : last.payment === "CASH"
              ? `${money(last.chargedCents)} à vista`
              : `${materialPaymentLabel(last.chargedCents, last.installmentCount)} no cartão`}
        </p>
      )}
    </div>
  );
}
