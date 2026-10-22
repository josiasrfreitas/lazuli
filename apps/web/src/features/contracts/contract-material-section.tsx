"use client";
import type { JSX as ReactJSX } from "react";
import { materialPriceQuote } from "@lazuli/domain";
import type { RouterOutputs } from "@lazuli/api";
import { Plus, X } from "lucide-react";
import { useEffect } from "react";
import { Button, FormRow, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money } from "~/lib/format";
import { SelectControl } from "~/features/classes/form-controls";
import type { FormProps } from "./contract-form-fields";

type Props = Pick<FormProps, "fields" | "change" | "errors"> & { required?: boolean };
type MaterialQuote = ReturnType<typeof materialPriceQuote> & { version: string };
type StageOptions = RouterOutputs["finance"]["contractMaterialOptions"];
type MaterialPrices = RouterOutputs["finance"]["readMaterialPrice"];
type StageProps = Props & {
  options: StageOptions | undefined;
  pending: boolean;
  failed: boolean;
  retry: () => void;
};
type DetailsProps = Props & {
  quote: MaterialQuote | undefined;
  prices: MaterialPrices | undefined;
  pricePending: boolean;
  priceFailed: boolean;
  retryPrice: () => void;
  stages: StageOptions | undefined;
  stagesPending: boolean;
  stagesFailed: boolean;
  retryStages: () => void;
};
type StageRowProps = {
  selected: string;
  index: number;
  selectedStages: string[];
  options: StageOptions;
  change: Props["change"];
};

function quotedMaterial(
  fields: Props["fields"],
  prices: MaterialPrices | undefined,
): MaterialQuote | undefined {
  let unitQuote = undefined;
  if (fields.materialCategory === "CHILD") unitQuote = prices?.child;
  else if (fields.materialCategory === "ADULT") unitQuote = prices?.adult;
  if (!unitQuote || !prices) return undefined;
  return {
    ...materialPriceQuote({
      installments: unitQuote.installments * fields.materialStageIds.split(",").length,
      installmentCents: unitQuote.installmentCents,
      cardFeePct: prices.cardFeePct,
    }),
    version: unitQuote.version,
  };
}

function MaterialStageRow({
  selected,
  index,
  selectedStages,
  options,
  change,
}: StageRowProps): ReactJSX.Element {
  return (
    <div className="flex min-w-0 items-end gap-2">
      <div className="min-w-0 flex-1">
        <SelectControl
          name={`material-stage-${index}`}
          label={`Livro ${index + 1}`}
          value={selected}
          onChange={(value) =>
            change(
              "materialStageIds",
              selectedStages.map((id, position) => (position === index ? value : id)).join(","),
            )
          }
          choices={options
            .filter((stage) => stage.id === selected || !selectedStages.includes(stage.id))
            .map((stage) => ({
              value: stage.id,
              label: `${stage.name} · ${stage.internalCode} · ${stage.track.name}`,
            }))}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={selectedStages.length === 1}
        aria-label={`Remover livro ${index + 1}`}
        onClick={() =>
          change(
            "materialStageIds",
            selectedStages.filter((_unused, position) => position !== index).join(","),
          )
        }
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

function MaterialStages({
  fields,
  change,
  errors,
  options,
  pending,
  failed,
  retry,
}: StageProps): ReactJSX.Element {
  const selectedStages = fields.materialStageIds.split(",");
  if (pending) return <InlineSkeleton className="h-20 w-full" />;
  if (failed)
    return (
      <p role="alert" className="text-sm">
        Não foi possível carregar os estágios.{" "}
        <Button type="button" variant="link" onClick={retry}>
          Tentar novamente
        </Button>
      </p>
    );
  return (
    <div className="grid gap-3">
      {selectedStages.map((selected, index) => (
        <MaterialStageRow
          key={index}
          selected={selected}
          index={index}
          selectedStages={selectedStages}
          options={options ?? []}
          change={change}
        />
      ))}
      {errors.materialStageIds && (
        <p role="alert" className="text-sm text-destructive">
          {errors.materialStageIds}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="justify-self-start"
        onClick={() => change("materialStageIds", `${fields.materialStageIds},`)}
      >
        <Plus aria-hidden="true" />
        Incluir outro livro
      </Button>
    </div>
  );
}

function MaterialPriceStatus({
  fields,
  prices,
  quote,
  pending,
  failed,
  retry,
}: {
  fields: Props["fields"];
  prices: MaterialPrices | undefined;
  quote: MaterialQuote | undefined;
  pending: boolean;
  failed: boolean;
  retry: () => void;
}): ReactJSX.Element | null {
  if (pending) return <InlineSkeleton className="h-5 w-32" />;
  if (failed)
    return (
      <p role="alert">
        Preço indisponível.{" "}
        <Button type="button" variant="link" onClick={retry}>
          Tentar novamente
        </Button>
      </p>
    );
  if (prices === null) return <p role="alert">Configure os preços em Ajustes.</p>;
  if (!quote) return null;
  if (fields.materialPayment === "CASH")
    return (
      <>
        <strong className="font-numeric text-base tabular-nums">
          {money(quote.cashCents)} à vista
        </strong>
        <span className="text-muted-foreground">Recebimento único</span>
      </>
    );
  return (
    <>
      <strong className="font-numeric text-base tabular-nums">
        {quote.installments} × {money(quote.installmentCents)} no cartão
      </strong>
      <span className="text-muted-foreground">
        Total {money(quote.totalCents)} · taxa {prices?.cardFeePct.toLocaleString("pt-BR")}% (
        {money(quote.totalCents - quote.cashCents)})
      </span>
      <span className="text-muted-foreground">Líquido para a escola {money(quote.cashCents)}</span>
    </>
  );
}

function MaterialPriceRow({
  fields,
  change,
  errors,
  quote,
  prices,
  pricePending,
  priceFailed,
  retryPrice,
}: Pick<
  DetailsProps,
  | "fields"
  | "change"
  | "errors"
  | "quote"
  | "prices"
  | "pricePending"
  | "priceFailed"
  | "retryPrice"
>): ReactJSX.Element {
  return (
    <FormRow columns={2}>
      <SelectControl
        name="materialCategory"
        label="Faixa de preço"
        value={fields.materialCategory}
        onChange={(value) => change("materialCategory", value)}
        error={errors.materialCategory}
        choices={[
          { value: "CHILD", label: "Infantil" },
          { value: "ADULT", label: "Adulto" },
        ]}
      />
      <div className="flex flex-col justify-center gap-1 text-sm" aria-live="polite">
        <MaterialPriceStatus
          fields={fields}
          prices={prices}
          quote={quote}
          pending={pricePending}
          failed={priceFailed}
          retry={retryPrice}
        />
      </div>
    </FormRow>
  );
}

function MaterialDetails({
  fields,
  change,
  errors,
  quote,
  prices,
  pricePending,
  priceFailed,
  retryPrice,
  stages,
  stagesPending,
  stagesFailed,
  retryStages,
}: DetailsProps): ReactJSX.Element {
  return (
    <>
      <MaterialStages
        fields={fields}
        change={change}
        errors={errors}
        options={stages}
        pending={stagesPending}
        failed={stagesFailed}
        retry={retryStages}
      />
      <MaterialPriceRow
        fields={fields}
        change={change}
        errors={errors}
        quote={quote}
        prices={prices}
        pricePending={pricePending}
        priceFailed={priceFailed}
        retryPrice={retryPrice}
      />
      {errors.materialTotal && (
        <p role="alert" className="text-sm text-destructive">
          {errors.materialTotal}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {fields.materialPayment === "CASH"
          ? "O material tem um único recebimento."
          : "Repasse integral em até 24h após a venda no cartão."}
      </p>
    </>
  );
}

function MaterialPaymentControl({ fields, change, errors, required }: Props): ReactJSX.Element {
  return (
    <SelectControl
      name="materialPayment"
      label="Aquisição de material"
      value={fields.materialPayment}
      onChange={(value) => change("materialPayment", value)}
      error={errors.materialPayment}
      choices={[
        ...(required ? [] : [{ value: "NONE", label: "Sem nova aquisição" }]),
        { value: "INSTALLMENTS", label: "Cartão de crédito" },
        { value: "CASH", label: "À vista" },
      ]}
    />
  );
}

function materialTotal(
  quote: MaterialQuote | undefined,
  payment: Props["fields"]["materialPayment"],
): number | undefined {
  if (!quote) return undefined;
  if (payment === "CASH") return quote.cashCents;
  return quote.totalCents;
}

export function ContractMaterialSection({
  fields,
  change,
  errors,
  required = false,
}: Props): ReactJSX.Element {
  const enabled = fields.materialPayment !== "NONE";
  const prices = trpc.finance.readMaterialPrice.useQuery(undefined, { enabled });
  const stages = trpc.finance.contractMaterialOptions.useQuery(undefined, { enabled });
  const quote = quotedMaterial(fields, prices.data);
  const total = materialTotal(quote, fields.materialPayment);
  const text = total === undefined ? "" : String(total);
  const version = quote?.version ?? "";
  useEffect(() => {
    if (fields.materialQuoteVersion !== version) change("materialQuoteVersion", version);
    if (fields.materialTotal !== text) change("materialTotal", text);
  }, [fields.materialTotal, fields.materialQuoteVersion, version, text, change]);
  return (
    <section
      aria-label="Material do contrato"
      className="grid min-w-0 gap-3 border-t border-border pt-4"
    >
      <MaterialPaymentControl fields={fields} change={change} errors={errors} required={required} />
      {enabled && (
        <MaterialDetails
          fields={fields}
          change={change}
          errors={errors}
          quote={quote}
          prices={prices.data}
          pricePending={prices.isPending}
          priceFailed={prices.isError}
          retryPrice={() => void prices.refetch()}
          stages={stages.data}
          stagesPending={stages.isPending}
          stagesFailed={stages.isError}
          retryStages={() => void stages.refetch()}
        />
      )}
    </section>
  );
}
