"use client";

import { materialPriceQuote, materialScholarshipQuote, addCalendarMonths } from "@lazuli/domain";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { useId, type ReactElement } from "react";
import { ChevronDown } from "lucide-react";
import { Button, Field, FieldError, Input, Label } from "@lazuli/ui";
import { parseDateBR } from "~/lib/masks";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import type { FormProps } from "./contract-form-fields";
import { materialPriceInput, scholarshipInput, paymentPlanLabel } from "./contract-form-model";

const CENTS_PER_REAL = 100;

function PaymentCalendar({
  rows,
}: {
  rows: Array<{ dueDate: string; tuitionCents: number; materialCents: number }>;
}): ReactElement {
  return (
    <div className="max-h-64 overflow-y-auto rounded-md border border-border">
      <ol aria-label="Calendário de parcelas" className="divide-y divide-border">
        <li className="grid grid-cols-4 gap-2 px-3 py-2 text-caption text-muted-foreground">
          <span>Vencimento</span>
          <span className="text-right">Mensalidade</span>
          <span className="text-right">Material</span>
          <span className="text-right">Total</span>
        </li>
        {rows.map((row) => (
          <li
            key={row.dueDate}
            className="grid grid-cols-4 gap-2 px-3 py-2 text-caption font-numeric tabular-nums"
          >
            <time dateTime={row.dueDate}>{formatDateOnlyBR(row.dueDate)}</time>
            <span className="text-right">
              {row.tuitionCents ? formatBRLFromCents(row.tuitionCents) : "—"}
            </span>
            <span className="text-right">
              {row.materialCents ? formatBRLFromCents(row.materialCents) : "—"}
            </span>
            <strong className="text-right font-medium">
              {formatBRLFromCents(row.tuitionCents + row.materialCents)}
            </strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PaymentPreview({ preview }: { preview: NonNullable<FormProps["preview"]> }): ReactElement {
  if (preview.installments.length === 0)
    return (
      <p role="status" className="text-caption">
        Bolsa integral até {formatDateOnlyBR(preview.endsOn)}. Não serão geradas parcelas de
        mensalidade.
      </p>
    );
  const firstAmount = preview.installments[0]?.amountCents ?? null;
  const uniformAmount = preview.installments.every((row) => row.amountCents === firstAmount)
    ? firstAmount
    : null;
  return (
    <>
      <div
        className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-caption font-numeric tabular-nums"
        aria-live="polite"
      >
        <p>
          Vigência até {formatDateOnlyBR(preview.endsOn)} · mensalidades{" "}
          {formatBRLFromCents(preview.principalAmountCents)}
        </p>
        <p>{paymentPlanLabel(preview.installments.length, uniformAmount)}</p>
        <p className="text-muted-foreground">
          Mensalidade de referência em dia {formatBRLFromCents(preview.onTimeMonthlyCents)} · piso
          da mensalidade acordada {formatBRLFromCents(preview.floorCents)}
        </p>
        <p>
          Primeiro vencimento {formatDateOnlyBR(preview.installments[0]?.dueDate)} · último{" "}
          {formatDateOnlyBR(preview.installments.at(-1)?.dueDate)}
        </p>
      </div>
    </>
  );
}

function useMaterialPayment(fields: FormProps["fields"]): {
  count: number;
  amountCents: number;
} | null {
  const prices = trpc.finance.readMaterialPrice.useQuery(undefined, {
    enabled: fields.materialPayment !== "NONE",
  });
  const quote = materialQuote(fields, prices.data);
  if (fields.materialPayment === "NONE" || !quote) return null;
  try {
    const net = materialScholarshipQuote({
      ...materialPriceInput(fields),
      quote,
      payment: fields.materialPayment === "CASH" ? "CASH" : "INSTALLMENTS",
      scholarshipPct: scholarshipInput(fields, true).scholarshipPct ?? 0,
      cardFeePct: prices.data?.cardFeePct ?? 0,
    });
    return net.receivableCents > 0 ? { count: 1, amountCents: net.receivableCents } : null;
  } catch {
    return null;
  }
}

function materialQuote(
  fields: FormProps["fields"],
  prices: RouterOutputs["finance"]["readMaterialPrice"] | undefined,
): (ReturnType<typeof materialPriceQuote> & { version: string }) | undefined {
  if (!prices) return undefined;
  let unitQuote;
  if (fields.materialCategory === "CHILD") unitQuote = prices.child;
  else if (fields.materialCategory === "ADULT") unitQuote = prices.adult;
  if (!unitQuote) return undefined;
  return {
    ...materialPriceQuote({
      installments: unitQuote.installments * fields.materialStageIds.split(",").length,
      installmentCents: unitQuote.installmentCents,
      cardFeePct: prices.cardFeePct,
    }),
    version: unitQuote.version,
  };
}

export function PaymentSection({ fields, errors, change, preview }: FormProps): ReactElement {
  const material = useMaterialPayment(fields);
  const enrollmentFeeCents = fields.enrollmentFee
    ? Math.round(Number(fields.enrollmentFee.replace(",", ".")) * CENTS_PER_REAL)
    : 0;
  const rows = preview
    ? previewCalendar(preview.installments, material, parseDateBR(fields.firstDueDate) ?? undefined)
    : [];
  const id = useId();
  const special = fields.paymentPlan === "special" && fields.scholarshipMode !== "FULL";
  return (
    <div className="grid min-w-0 gap-3">
      {fields.scholarshipMode !== "FULL" && (
        <AdvancedPaymentControls
          id={id}
          special={special}
          fields={fields}
          errors={errors}
          change={change}
        />
      )}
      {preview ? (
        <PaymentPreviewDetails
          {...{ preview, enrollmentFeeCents, material, special, rows }}
          agreedOn={fields.agreedOn}
        />
      ) : (
        <p className="text-caption text-muted-foreground">
          Informe as datas, a mensalidade e uma quantidade válida para conferir as cobranças.
        </p>
      )}
    </div>
  );
}

function PaymentPreviewDetails({
  preview,
  enrollmentFeeCents,
  material,
  special,
  rows,
  agreedOn,
}: {
  preview: NonNullable<FormProps["preview"]>;
  enrollmentFeeCents: number;
  material: { count: number; amountCents: number } | null;
  special: boolean;
  rows: Array<{ dueDate: string; tuitionCents: number; materialCents: number }>;
  agreedOn: string;
}): ReactElement {
  return (
    <>
      <PaymentPreview preview={preview} />
      {enrollmentFeeCents > 0 && (
        <p className="text-caption">
          Taxa de matrícula {formatBRLFromCents(enrollmentFeeCents)} · vence na data do acordo,{" "}
          {agreedOn}
        </p>
      )}
      {(material || enrollmentFeeCents > 0) && (
        <p className="text-caption font-medium">
          Total a receber pela escola{" "}
          {formatBRLFromCents(
            preview.principalAmountCents +
              (material?.count ?? 0) * (material?.amountCents ?? 0) +
              enrollmentFeeCents,
          )}
        </p>
      )}
      {(special || material) && <PaymentCalendar rows={rows} />}
    </>
  );
}

function AdvancedPaymentControls({
  id,
  special,
  fields,
  errors,
  change,
}: Pick<FormProps, "fields" | "errors" | "change"> & {
  id: string;
  special: boolean;
}): ReactElement {
  const arrowClass = special ? "rotate-180 transition-transform" : "transition-transform";
  return (
    <>
      <Button
        type="button"
        variant="text"
        size="inline"
        className="justify-self-start"
        aria-expanded={special}
        aria-controls={id}
        onClick={() => change("paymentPlan", special ? "common" : "special")}
      >
        Parcelamento avançado
        <ChevronDown aria-hidden="true" className={arrowClass} />
      </Button>
      <div id={id} hidden={!special} className="space-y-2">
        {special && (
          <Field name="installmentCount">
            <Label>Quantidade de parcelas</Label>
            <Input
              name="installmentCount"
              placeholder="Ex.: 3"
              autoComplete="off"
              inputMode="numeric"
              size="sm"
              value={fields.installmentCount}
              invalid={Boolean(errors.installmentCount)}
              onChange={(event) => change("installmentCount", event.target.value)}
              aria-describedby={`${id}-help`}
            />
            <p id={`${id}-help`} className="text-caption text-muted-foreground">
              De 1 até a duração do contrato em meses. O principal e a vigência permanecem iguais.
            </p>
            {errors.installmentCount && <FieldError match>{errors.installmentCount}</FieldError>}
          </Field>
        )}
      </div>
    </>
  );
}

export function previewCalendar(
  tuition: Array<{ dueDate: string; amountCents: number }>,
  ...[material, materialDueDate]: [{ count: number; amountCents: number } | null, string?]
): { dueDate: string; tuitionCents: number; materialCents: number }[] {
  const first = tuition[0]?.dueDate ?? materialDueDate;
  if (!first) return [];
  return Array.from(
    { length: Math.max(tuition.length, material?.count ?? 0) },
    (_unused, index) => ({
      dueDate: addCalendarMonths(first, index),
      tuitionCents: tuition[index]?.amountCents ?? 0,
      materialCents: material && index < material.count ? material.amountCents : 0,
    }),
  );
}
