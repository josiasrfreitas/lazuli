"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { BookOpen } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { RouterOutputs } from "@lazuli/api";
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
const MAX_PERSISTED_CENTS = 2_147_483_647;

type MaterialQueries = {
  prices: UseQueryResult<RouterOutputs["finance"]["readMaterialPrice"], { message: string }>;
  status: UseQueryResult<RouterOutputs["finance"]["studentMaterials"], { message: string }>;
  stages: UseQueryResult<RouterOutputs["finance"]["contractMaterialOptions"], { message: string }>;
};

function useMaterialQueries(fields: MaterialProps["fields"]): MaterialQueries {
  const prices = trpc.finance.readMaterialPrice.useQuery();
  const status = trpc.finance.studentMaterials.useQuery(
    { studentId: fields.studentId },
    { enabled: Boolean(fields.studentId) },
  );
  const stages = trpc.finance.contractMaterialOptions.useQuery();
  return { prices, status, stages };
}

export type SetupMaterial = {
  prices: MaterialQueries["prices"];
  stages: MaterialQueries["stages"];
  status: MaterialQueries["status"];
  quote: ReturnType<typeof materialPriceQuote> | null;
  effective: ReturnType<typeof materialScholarshipQuote> | null;
  count: number;
  plan: ReturnType<typeof materialInstallmentPlan> | null;
  installmentError: string;
  priceError: string;
};

function priceForCategory(
  category: string,
  prices: SetupMaterial["prices"]["data"],
): NonNullable<SetupMaterial["prices"]["data"]>["adult"] | undefined {
  if (category === "CHILD") return prices?.child;
  if (category === "ADULT") return prices?.adult;
  return undefined;
}

function materialQuote({
  enabled,
  unit,
  prices,
  count,
}: {
  enabled: boolean;
  unit: ReturnType<typeof priceForCategory>;
  prices: SetupMaterial["prices"]["data"];
  count: number;
}): SetupMaterial["quote"] {
  if (!enabled || !unit || !prices || count === 0) return null;
  return materialPriceQuote({
    installments: unit.installments * count,
    installmentCents: unit.installmentCents,
    cardFeePct: prices.cardFeePct,
  });
}

function materialPriceError(fields: MaterialProps["fields"]): string {
  const override = materialPriceInput(fields).priceOverrideCents;
  if (override === undefined) return "";
  if (Number.isInteger(override) && override >= 1 && override <= MAX_PERSISTED_CENTS) return "";
  return "Informe um valor válido maior que zero.";
}

function effectiveMaterialQuote({
  fields,
  quote,
  prices,
}: {
  fields: MaterialProps["fields"];
  quote: SetupMaterial["quote"];
  prices: SetupMaterial["prices"]["data"];
}): SetupMaterial["effective"] {
  if (!quote || !prices) return null;
  try {
    return materialScholarshipQuote({
      quote,
      ...materialPriceInput(fields),
      payment: fields.materialPayment === "CASH" ? "CASH" : "INSTALLMENTS",
      scholarshipPct: scholarshipInput(fields, true).scholarshipPct ?? 0,
      cardFeePct: prices.cardFeePct,
    });
  } catch {
    return null;
  }
}

function installmentPlan(
  fields: MaterialProps["fields"],
  effective: SetupMaterial["effective"],
): Pick<SetupMaterial, "plan" | "installmentError"> {
  if (!effective) return { plan: null, installmentError: "" };
  try {
    return {
      plan: materialInstallmentPlan(effective.chargedCents, materialInstallmentCount(fields)),
      installmentError: "",
    };
  } catch (error) {
    return {
      plan: null,
      installmentError:
        error instanceof Error ? error.message : "Confira a quantidade de parcelas.",
    };
  }
}

function useSuggestedStage({
  fields,
  change,
  stages,
  suggested,
}: {
  fields: MaterialProps["fields"];
  change: MaterialProps["change"];
  stages: SetupMaterial["stages"];
  suggested: string | null | undefined;
}): void {
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
}

function useSyncMaterialQuote({
  fields,
  change,
  version,
  total,
}: {
  fields: MaterialProps["fields"];
  change: MaterialProps["change"];
  version: string;
  total: string;
}): void {
  useEffect(() => {
    if (fields.materialQuoteVersion !== version) change("materialQuoteVersion", version);
    if (fields.materialTotal !== total) change("materialTotal", total);
  }, [change, fields.materialQuoteVersion, fields.materialTotal, total, version]);
}

export function useSetupMaterial({
  fields,
  change,
  suggestedStageId,
}: Pick<MaterialProps, "fields" | "change"> & {
  suggestedStageId?: string | null | undefined;
}): SetupMaterial {
  const enabled = fields.materialPayment !== "NONE";
  const { prices, status, stages } = useMaterialQueries(fields);
  const suggested = suggestedStageId ?? status.data?.suggestedStageId;
  useSuggestedStage({ fields, change, stages, suggested });
  const count = fields.materialStageIds.split(",").filter(Boolean).length;
  const unit = priceForCategory(fields.materialCategory, prices.data);
  const quote = materialQuote({ enabled, unit, prices: prices.data, count });
  const priceError = materialPriceError(fields);
  const effective = effectiveMaterialQuote({ fields, quote, prices: prices.data });
  const total = quote
    ? String(fields.materialPayment === "CASH" ? quote.cashCents : quote.totalCents)
    : "";
  const version = enabled ? (unit?.version ?? "") : "";
  useSyncMaterialQuote({ fields, change, version, total });
  const { plan, installmentError } = installmentPlan(fields, effective);
  return { prices, stages, quote, effective, count, plan, installmentError, status, priceError };
}

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
  return (
    <div className={styles.materialFields}>
      {allowNoAcquisition && <MaterialAcquisitionChoice enabled={enabled} change={change} />}
      {allowNoAcquisition && <PreviousMaterial material={material} />}
      <fieldset disabled={!enabled} className="grid min-w-0 gap-3 disabled:opacity-50">
        <MaterialBooks fields={fields} errors={errors} change={change} material={material} />
        <div className={styles.materialTerms}>
          <MaterialCategory fields={fields} errors={errors} change={change} />
          <MaterialPayment fields={fields} change={change} />
          <MaterialInstallments
            fields={fields}
            errors={errors}
            change={change}
            material={material}
          />
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
        {errors.materialTotal && <MaterialTotalError message={errors.materialTotal} />}
      </fieldset>
    </div>
  );
}

function MaterialTotalError({ message }: { message: string }): ReactElement {
  return (
    <p role="alert" tabIndex={-1} aria-invalid="true" className="text-caption text-destructive">
      {message}
    </p>
  );
}

function MaterialAcquisitionChoice({
  enabled,
  change,
}: {
  enabled: boolean;
  change: MaterialProps["change"];
}): ReactElement {
  return (
    <Field name="materialAcquisition">
      <Label>Material neste contrato</Label>
      <SegmentedControl
        size="sm"
        wrap
        value={enabled ? "BUY" : "NONE"}
        onValueChange={(value) => {
          if (value) change("materialPayment", value === "NONE" ? "NONE" : "CASH");
        }}
        aria-label="Material neste contrato"
      >
        <SegmentedControlItem value="NONE">Sem nova aquisição</SegmentedControlItem>
        <SegmentedControlItem value="BUY">Adquirir material</SegmentedControlItem>
      </SegmentedControl>
    </Field>
  );
}

function MaterialBooks({
  fields,
  errors,
  change,
  material,
}: MaterialProps & { material: SetupMaterial }): ReactElement {
  return (
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
  );
}

function MaterialCategory({ fields, errors, change }: MaterialProps): ReactElement {
  return (
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
  );
}

function MaterialPayment({
  fields,
  change,
}: Pick<MaterialProps, "fields" | "change">): ReactElement {
  return (
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
  );
}

function MaterialInstallments({
  fields,
  errors,
  change,
  material,
}: MaterialProps & { material: SetupMaterial }): ReactElement {
  const enabled =
    fields.materialPayment === "INSTALLMENTS" && fields.materialScholarshipMode !== "FULL";
  const error = errors.materialInstallments || material.installmentError;
  return (
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
        disabled={!enabled}
        value={enabled ? fields.materialInstallments : "1"}
        onChange={(event) => change("materialInstallments", event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}

type MaterialSummaryProps = Pick<MaterialProps, "fields"> & {
  material: SetupMaterial;
  change?: MaterialProps["change"] | undefined;
  errors?: MaterialProps["errors"] | undefined;
};

export function MaterialQuoteSummary({
  fields,
  material,
  change,
  errors,
}: MaterialSummaryProps): ReactElement {
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
  return <MaterialQuoteBody fields={fields} material={material} change={change} errors={errors} />;
}

function materialChargeLabel(fields: MaterialProps["fields"], material: SetupMaterial): string {
  if (fields.materialScholarshipMode === "FULL") return "Bolsa integral · aquisição sem cobrança";
  if (fields.materialPayment === "CASH") return "À vista, em um único pagamento";
  if (!material.plan || !material.effective)
    return "Informe o parcelamento do total desta aquisição";
  return `${materialPaymentLabel(material.effective.chargedCents, material.plan.installmentCount)} no cartão`;
}

function MaterialQuoteBody({
  fields,
  material,
  change,
  errors,
}: MaterialSummaryProps): ReactElement {
  const { effective } = material;
  return (
    <div className={styles.materialTotal} aria-live="polite">
      <MaterialPriceDisplay fields={fields} material={material} change={change} errors={errors} />
      {change && fields.materialScholarshipMode !== "NONE" && effective && (
        <div>
          <span>Com bolsa</span>
          <strong>{money(effective.chargedCents)}</strong>
        </div>
      )}
      {effective && <p>{materialChargeLabel(fields, material)}</p>}
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

function MaterialPriceDisplay({
  fields,
  material,
  change,
  errors,
}: MaterialSummaryProps): ReactElement {
  if (change && material.quote)
    return (
      <MaterialAgreedPrice
        fields={fields}
        change={change}
        referenceCents={
          fields.materialPayment === "CASH" ? material.quote.cashCents : material.quote.totalCents
        }
        error={errors?.materialCustomPrice || material.priceError || undefined}
      />
    );
  return (
    <div>
      <span>Total do material</span>
      <strong>{material.effective ? money(material.effective.chargedCents) : "—"}</strong>
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
          {lastMaterialPayment(last)}
        </p>
      )}
    </div>
  );
}

function lastMaterialPayment(
  last: NonNullable<SetupMaterial["status"]["data"]>["acquisitions"][number],
): string {
  if (last.chargedCents === 0) return "Bolsa integral";
  if (last.payment === "CASH") return `${money(last.chargedCents)} à vista`;
  return `${materialPaymentLabel(last.chargedCents, last.installmentCount)} no cartão`;
}
