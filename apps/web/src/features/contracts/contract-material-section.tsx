"use client";
import type { JSX as ReactJSX } from "react";
import { materialPriceQuote } from "@lazuli/domain";
import { Plus, X } from "lucide-react";
import { useEffect } from "react";
import { Button, FormRow, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money } from "~/lib/format";
import { SelectControl } from "~/features/classes/form-controls";
import type { FormProps } from "./contract-form-fields";

type Props = Pick<FormProps, "fields" | "change" | "errors"> & { required?: boolean };
export function ContractMaterialSection({
  fields,
  change,
  errors,
  required = false,
}: Props): ReactJSX.Element {
  const selectedStages = fields.materialStageIds.split(",");
  const enabled = fields.materialPayment !== "NONE";
  const prices = trpc.finance.readMaterialPrice.useQuery(undefined, { enabled });
  const stages = trpc.finance.contractMaterialOptions.useQuery(undefined, { enabled });
  const unitQuote =
    fields.materialCategory === "CHILD"
      ? prices.data?.child
      : fields.materialCategory === "ADULT"
        ? prices.data?.adult
        : undefined;
  const quote =
    unitQuote && prices.data
      ? {
          ...materialPriceQuote({
            installments: unitQuote.installments * selectedStages.length,
            installmentCents: unitQuote.installmentCents,
            cardFeePct: prices.data.cardFeePct,
          }),
          version: unitQuote.version,
        }
      : undefined;
  const total = quote
    ? fields.materialPayment === "CASH"
      ? quote.cashCents
      : quote.totalCents
    : undefined;
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
      {enabled && (
        <>
          {stages.isPending ? (
            <InlineSkeleton className="h-20 w-full" />
          ) : stages.isError ? (
            <p role="alert" className="text-caption">
              Não foi possível carregar os estágios.{" "}
              <Button type="button" variant="link" onClick={() => void stages.refetch()}>
                Tentar novamente
              </Button>
            </p>
          ) : (
            <div className="grid gap-3">
              {selectedStages.map((selected, index) => (
                <div
                  key={index}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
                >
                  <SelectControl
                    name={`material-stage-${index}`}
                    label={`Livro ${index + 1}`}
                    value={selected}
                    onChange={(value) =>
                      change(
                        "materialStageIds",
                        selectedStages
                          .map((id, position) => (position === index ? value : id))
                          .join(","),
                      )
                    }
                    choices={(stages.data ?? [])
                      .filter(
                        (stage) => stage.id === selected || !selectedStages.includes(stage.id),
                      )
                      .map((stage) => ({
                        value: stage.id,
                        label: `${stage.name} · ${stage.internalCode} · ${stage.track.name}`,
                      }))}
                  />
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
              ))}
              {errors.materialStageIds && (
                <p role="alert" className="text-caption text-destructive">
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
          )}
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
            <div className="flex flex-col justify-center gap-1 text-caption" aria-live="polite">
              {prices.isPending ? (
                <InlineSkeleton className="h-5 w-32" />
              ) : prices.isError ? (
                <p role="alert">
                  Preço indisponível.{" "}
                  <Button type="button" variant="link" onClick={() => void prices.refetch()}>
                    Tentar novamente
                  </Button>
                </p>
              ) : prices.data === null ? (
                <p role="alert">Configure os preços em Ajustes.</p>
              ) : (
                quote && (
                  <>
                    <strong className="font-numeric text-base tabular-nums">
                      {fields.materialPayment === "CASH"
                        ? `${money(quote.cashCents)} à vista`
                        : `${quote.installments} × ${money(quote.installmentCents)} no cartão`}
                    </strong>
                    <span className="text-muted-foreground">
                      {fields.materialPayment === "CASH"
                        ? "Recebimento único"
                        : `Total ${money(quote.totalCents)} · taxa ${prices.data?.cardFeePct.toLocaleString("pt-BR")}% (${money(quote.totalCents - quote.cashCents)})`}
                    </span>
                    {fields.materialPayment !== "CASH" && (
                      <span className="text-muted-foreground">
                        Líquido para a escola {money(quote.cashCents)}
                      </span>
                    )}
                  </>
                )
              )}
            </div>
          </FormRow>
          {errors.materialTotal && (
            <p role="alert" className="text-caption text-destructive">
              {errors.materialTotal}
            </p>
          )}
          <p className="text-caption text-muted-foreground">
            {fields.materialPayment === "CASH"
              ? "O material tem um único recebimento."
              : "Repasse integral em até 24h após a venda no cartão."}
          </p>
        </>
      )}
    </section>
  );
}
