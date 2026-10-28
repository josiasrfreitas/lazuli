import type { ReactElement } from "react";
import {
  Checkbox,
  CurrencyInput,
  Field,
  FieldError,
  FormRow,
  FormSection,
  Label,
} from "@lazuli/ui";
import { NarrativeField } from "~/features/shared/task-form";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import type { RenegotiationOptions, RenegotiationPreview } from "./contract-renegotiation-dialog";

export function RenegotiationFields({
  options,
  ids,
  amount,
  reason,
  errors,
  onIds,
  onAmount,
  onReason,
}: {
  options: RenegotiationOptions;
  ids: string[];
  amount: number | null;
  reason: string;
  errors: Record<string, string>;
  onIds: (ids: string[]) => void;
  onAmount: (amount: number | null) => void;
  onReason: (reason: string) => void;
}): ReactElement {
  return (
    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
      <FormSection title="Novas condições" className="md:border-r md:pr-4">
        <FormRow>
          <Field>
            <Label htmlFor="renegotiation-amount">Novo valor por parcela selecionada</Label>
            <div className="max-w-48">
              <CurrencyInput
                id="renegotiation-amount"
                name="newAmountCents"
                autoComplete="off"
                placeholder="R$ 0,00"
                size="sm"
                value={amount}
                onValueChange={onAmount}
                invalid={Boolean(errors.newAmountCents)}
              />
            </div>
            <FieldError match={Boolean(errors.newAmountCents)}>
              {errors.newAmountCents ? "Informe o novo valor em reais." : undefined}
            </FieldError>
          </Field>
        </FormRow>
        <NarrativeField
          name="reason"
          label="Motivo e condições negociadas"
          value={reason}
          onChange={onReason}
          placeholder="Explique a situação e o acordo com o responsável"
          rows={2}
          error={errors.reason}
        />
        <p className="text-caption text-muted-foreground">
          O novo valor vale apenas para as parcelas selecionadas. Pagamentos recebidos e vencimentos
          são preservados. Encargos já apurados continuam devidos; esta redução não acumula desconto
          por pontualidade.
        </p>
      </FormSection>
      <FormSection
        title={`Parcelas do contrato · ${ids.length} selecionadas`}
        description="Escolha quais mensalidades terão o valor reduzido."
      >
        <Field>
          <div
            className="max-h-64 overflow-y-auto"
            tabIndex={0}
            role="group"
            aria-label="Parcelas para renegociar"
            aria-invalid={Boolean(errors.installmentIds)}
          >
            {options.lines.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">
                Nenhuma parcela com principal em aberto para reduzir.
              </p>
            )}
            {options.lines.map((line) => (
              <label key={line.id} className="flex items-start gap-2 border-b py-2 text-caption">
                <Checkbox
                  aria-labelledby={`renegotiation-line-${line.id}`}
                  checked={ids.includes(line.id)}
                  onCheckedChange={(checked) =>
                    onIds(checked ? [...ids, line.id] : ids.filter((id) => id !== line.id))
                  }
                />
                <span id={`renegotiation-line-${line.id}`} className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap justify-between gap-x-3 font-medium">
                    <span>
                      Parcela {line.sequence} · {formatDateOnlyBR(line.dueDate)}
                    </span>
                    <span className="font-numeric tabular-nums">{money(line.principalCents)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {line.dueDate < options.today ? "Vencida" : "A vencer"}
                    {line.paidCents > 0 &&
                      ` · Pago ${money(line.paidCents)} · mínimo ${money(line.minimumCents)}`}
                    {line.chargesCents > 0 && ` · encargos ${money(line.chargesCents)}`}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <FieldError match={Boolean(errors.installmentIds)}>{errors.installmentIds}</FieldError>
        </Field>
      </FormSection>
    </div>
  );
}

export function RenegotiationReview({
  preview,
  reason,
}: {
  preview: RenegotiationPreview;
  reason: string;
}): ReactElement {
  const before = preview.lines.reduce((sum, line) => sum + line.balanceCents, 0);
  return (
    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
      <section className="grid gap-3 md:border-r md:pr-4" aria-label="Resumo da renegociação">
        <h3 className="text-sm font-semibold">Confira a redução</h3>
        <dl className="grid gap-2 text-sm">
          <Amount label="Saldo atual das selecionadas" cents={before} />
          <Amount label="Redução concedida" cents={preview.reductionCents} />
          <Amount label="Saldo após renegociação" cents={before - preview.reductionCents} />
        </dl>
        <p className="text-caption text-muted-foreground">
          O contrato e a matrícula continuam ativos. Encargos e pagamentos anteriores são
          preservados.
        </p>
        <p className="whitespace-pre-wrap text-caption">
          <strong>Motivo:</strong> {reason}
        </p>
      </section>
      <section className="grid gap-2" aria-label="Parcelas selecionadas">
        <h3 className="text-sm font-semibold">
          Novo valor: {money(preview.newAmountCents)} por parcela
        </h3>
        <ul className="max-h-64 overflow-y-auto text-caption">
          {preview.lines.map((line) => (
            <li key={line.id} className="grid gap-0.5 border-b py-2">
              <span className="flex flex-wrap justify-between gap-x-3">
                <span>
                  Parcela {line.sequence} · {formatDateOnlyBR(line.dueDate)}
                </span>
                <span>
                  {money(line.principalCents)} → {money(preview.newAmountCents)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Saldo a receber: {money(line.resultingBalanceCents)}
                {line.chargesCents > 0 && ` · inclui ${money(line.chargesCents)} em encargos`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Amount({ label, cents }: { label: string; cents: number }): ReactElement {
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <dt>{label}</dt>
      <dd className="font-numeric font-semibold tabular-nums">{money(cents)}</dd>
    </div>
  );
}

export function RenegotiationHistory({
  history,
}: {
  history: RenegotiationOptions["history"];
}): ReactElement | null {
  if (history.length === 0) return null;
  return (
    <details className="border-t pt-3 text-caption">
      <summary className="cursor-pointer font-medium">
        Renegociações anteriores · {history.length}
      </summary>
      <ul className="grid gap-3 pt-3">
        {history.map((row) => (
          <li key={row.id} className="grid gap-1">
            <p>
              {formatDateOnlyBR(row.effectiveDate)} · {row.installmentCount} parcela(s) a{" "}
              {money(row.newAmountCents)} · redução de {money(row.reductionCents)}
            </p>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {row.reason} · {row.actorName}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
