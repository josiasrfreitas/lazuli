import type { ReactElement } from "react";
import { ChevronDown } from "lucide-react";

import { FormRow, FormSection } from "@lazuli/ui";

import { SettingsField, type SettingsSectionProps } from "./settings-field";
import { floorLabel } from "./settings-model";

function TuitionSection(props: SettingsSectionProps): ReactElement {
  return (
    <FormSection title="Mensalidade" className="gap-2">
      <FormRow className="grid-cols-2 lg:grid-cols-3">
        <SettingsField
          {...props}
          name="tuitionCeilingCents"
          label="Valor máximo"
          unit="R$"
          placeholder="250,00"
          autoFocus
        />
        <SettingsField
          {...props}
          name="maximumDiscountPct"
          label="Desconto máximo"
          unit="%"
          placeholder="20"
        />
        <div className="col-span-2 flex items-center justify-between gap-2 lg:col-span-1 lg:grid lg:gap-1.5">
          <p className="text-caption text-muted-foreground">Mínimo com desconto</p>
          <output
            className="font-numeric flex min-h-7 items-center text-base font-semibold tabular-nums"
            aria-live="polite"
          >
            {floorLabel(props.fields)}
          </output>
        </div>
      </FormRow>
    </FormSection>
  );
}

function ChargesSection(props: SettingsSectionProps): ReactElement {
  return (
    <FormSection title="Atrasos e desistência" className="gap-2">
      <FormRow className="grid-cols-2 lg:grid-cols-3">
        <SettingsField
          {...props}
          name="interestRatePctDaily"
          label="Juros ao dia"
          unit="%"
          placeholder="0,1"
        />
        <SettingsField
          {...props}
          name="interestRatePctMonthly"
          label="Juros ao mês"
          unit="%"
          placeholder="2"
        />
        <SettingsField
          {...props}
          name="cancellationFeePct"
          label="Multa de desistência"
          unit="%"
          placeholder="10"
        />
      </FormRow>
      <details className="group text-caption text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring sm:min-h-0">
          <ChevronDown aria-hidden="true" className="size-3 group-open:rotate-180" />
          Como são calculados
        </summary>
        <p className="pt-2">
          Juros diários e por mês completo se somam sobre o saldo em atraso, sem juros sobre juros.
          A multa usa o valor das parcelas a vencer, sem desconto de pontualidade.
        </p>
      </details>
    </FormSection>
  );
}

export function SettingsSections(props: SettingsSectionProps): ReactElement {
  return (
    <div className="grid gap-3 p-4">
      <TuitionSection {...props} />
      <div className="border-t border-border pt-3">
        <ChargesSection {...props} />
      </div>
      <div className="border-t border-border pt-3">
        <FormSection title="Material didático" className="gap-2">
          <FormRow className="grid-cols-2 lg:grid-cols-3">
            <SettingsField
              {...props}
              name="materialPriceCents"
              label="Preço de venda"
              unit="R$"
              placeholder="120,00"
            />
          </FormRow>
        </FormSection>
      </div>
    </div>
  );
}
