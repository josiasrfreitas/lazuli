"use client";

import { useEffect, useState, type ReactElement } from "react";
import { BookOpen, CalendarClock, CreditCard, Wallet } from "lucide-react";
import { Button, Field, FieldError, FormSection, Input, Label } from "@lazuli/ui";

import {
  displaySetting,
  floorLabel,
  type SettingsErrors,
  type SettingsFields,
} from "./settings-model";

export type SettingsSectionProps = { fields: SettingsFields } & (
  | { readOnly: true }
  | {
      readOnly?: false;
      errors: SettingsErrors;
      disabled: boolean;
      onChange: (name: keyof SettingsFields, value: string) => void;
    }
);

type SettingName = Exclude<keyof SettingsFields, "materialCardFeeRates">;
type SectionKey = "tuition" | "charges" | "books";
const INSTALLMENT_OPTIONS = 12;
const INACTIVE_SECTION_CLASS = "hidden lg:block";

function SettingsField({
  name,
  label,
  unit,
  placeholder,
  autoFocus,
  ...props
}: SettingsSectionProps & {
  name: SettingName;
  label: string;
  unit: string;
  placeholder: string;
  autoFocus?: boolean;
}): ReactElement {
  if (props.readOnly)
    return (
      <dl className="grid min-w-0 gap-1">
        <dt className="text-caption text-muted-foreground">{label}</dt>
        <dd className="font-numeric text-base font-medium tabular-nums">
          {displaySetting(name, props.fields[name])}
        </dd>
      </dl>
    );
  return (
    <Field name={name} disabled={props.disabled} className="min-w-0">
      <Label>
        {label} <span className="text-muted-foreground">({unit})</span>
      </Label>
      <Input
        aria-required="true"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={props.disabled}
        inputMode="decimal"
        invalid={props.errors[name] !== undefined}
        name={name}
        placeholder={`Ex.: ${placeholder}`}
        size="xs"
        type="text"
        value={props.fields[name]}
        onChange={(event) => props.onChange(name, event.target.value)}
      />
      {props.errors[name] && <FieldError match>{props.errors[name]}</FieldError>}
    </Field>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Wallet;
  children: string;
}): ReactElement {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      {children}
    </span>
  );
}

function TuitionSection(props: SettingsSectionProps): ReactElement {
  return (
    <FormSection title={<SectionTitle icon={Wallet}>Mensalidade</SectionTitle>} className="gap-2">
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <SettingsField
          {...props}
          name="tuitionCeilingCents"
          label="Referência"
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
        <SettingsField
          {...props}
          name="punctualityDiscountPct"
          label="Pontualidade"
          unit="%"
          placeholder="0"
        />
        <div className="grid content-start gap-1 border-l border-border pl-3">
          <p className="text-caption text-muted-foreground">Piso negociável</p>
          <output className="font-numeric text-base font-semibold tabular-nums" aria-live="polite">
            {floorLabel(props.fields)}
          </output>
        </div>
      </div>
    </FormSection>
  );
}

function ChargesSection(props: SettingsSectionProps): ReactElement {
  return (
    <FormSection
      title={<SectionTitle icon={CalendarClock}>Atrasos e desistência</SectionTitle>}
      className="gap-2"
    >
      <div className="grid min-w-0 grid-cols-2 gap-3">
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
      </div>
      <p className="text-caption text-muted-foreground">
        Juros proporcionais aos dias de atraso; multa sobre parcelas a vencer.
      </p>
    </FormSection>
  );
}

function BookPrices(props: SettingsSectionProps): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid min-w-0 gap-1">
        <p className="text-caption font-semibold">Infantil</p>
        <SettingsField
          {...props}
          name="childMaterialCashPriceCents"
          label="Preço à vista"
          unit="R$"
          placeholder="664,20"
        />
      </div>
      <div className="grid min-w-0 gap-1 border-l border-border pl-3">
        <p className="text-caption font-semibold">Adulto</p>
        <SettingsField
          {...props}
          name="adultMaterialCashPriceCents"
          label="Preço à vista"
          unit="R$"
          placeholder="734,40"
        />
      </div>
    </div>
  );
}

function CardFeeRates(props: SettingsSectionProps): ReactElement {
  const rates = JSON.parse(props.fields.materialCardFeeRates) as Record<string, string>;
  const counts = [
    ...new Set([
      ...Array.from({ length: INSTALLMENT_OPTIONS }, (_unused, index) => index + 1),
      ...Object.keys(rates).map(Number),
    ]),
  ].toSorted((left, right) => left - right);
  const setRate = (count: number, value: string): void => {
    if (props.readOnly) return;
    const next = { ...rates };
    if (value.trim() === "") delete next[String(count)];
    else next[String(count)] = value;
    props.onChange("materialCardFeeRates", JSON.stringify(next));
  };
  return (
    <div className="grid gap-2">
      <p className="inline-flex items-center gap-2 text-caption font-semibold">
        <CreditCard aria-hidden="true" className="size-4 text-muted-foreground" />
        Taxa do cartão por parcelas (%)
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {counts.map((count) => (
          <CardFeeRate
            key={count}
            count={count}
            rate={rates[String(count)]}
            section={props}
            onChange={setRate}
          />
        ))}
      </div>
      {!props.readOnly && props.errors.materialCardFeeRates && (
        <p role="alert" className="text-caption text-destructive">
          {props.errors.materialCardFeeRates}
        </p>
      )}
    </div>
  );
}

function CardFeeRate({
  count,
  rate,
  section,
  onChange,
}: {
  count: number;
  rate: string | undefined;
  section: SettingsSectionProps;
  onChange: (count: number, value: string) => void;
}): ReactElement {
  if (section.readOnly)
    return (
      <dl className="grid min-w-0 gap-0.5 rounded-sm border border-border px-2 py-1">
        <dt className="text-caption text-muted-foreground">{count}x</dt>
        <dd className="font-numeric text-sm tabular-nums">
          {rate === undefined ? "—" : `${rate}%`}
        </dd>
      </dl>
    );
  return (
    <Field name={`materialCardFeeRates.${count}`} className="min-w-0 gap-0.5">
      <Label>{count}x</Label>
      <Input
        name={`materialCardFeeRates.${count}`}
        type="text"
        size="xs"
        inputMode="decimal"
        autoComplete="off"
        placeholder="10"
        value={rate ?? ""}
        disabled={section.disabled}
        invalid={Boolean(section.errors.materialCardFeeRates)}
        onChange={(event) => onChange(count, event.target.value)}
      />
    </Field>
  );
}

function BooksSection(props: SettingsSectionProps): ReactElement {
  return (
    <FormSection title={<SectionTitle icon={BookOpen}>Livros</SectionTitle>} className="gap-3">
      <BookPrices {...props} />
      <CardFeeRates {...props} />
      <p className="text-caption text-muted-foreground">
        A taxa escolhida é repassada ao cliente. Preços novos valem para novas vendas.
      </p>
    </FormSection>
  );
}

function tabForErrors(errors: SettingsErrors): SectionKey | null {
  if (errors.tuitionCeilingCents || errors.maximumDiscountPct || errors.punctualityDiscountPct)
    return "tuition";
  if (errors.interestRatePctMonthly || errors.cancellationFeePct) return "charges";
  if (
    errors.childMaterialCashPriceCents ||
    errors.adultMaterialCashPriceCents ||
    errors.materialCardFeeRates
  )
    return "books";
  return null;
}

export function SettingsSections(props: SettingsSectionProps): ReactElement {
  const [active, setActive] = useState<SectionKey>("tuition");
  const invalidTab = props.readOnly ? null : tabForErrors(props.errors);
  useEffect(() => {
    if (invalidTab) setActive(invalidTab);
  }, [invalidTab]);
  return (
    <div className="grid gap-3 p-3 sm:p-4">
      <nav
        className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1 lg:hidden"
        aria-label="Módulos dos ajustes"
      >
        {(
          [
            ["tuition", "Mensalidade"],
            ["charges", "Encargos"],
            ["books", "Livros"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={active === key ? "secondary" : "ghost"}
            aria-current={active === key ? "page" : undefined}
            onClick={() => setActive(key)}
          >
            {label}
          </Button>
        ))}
      </nav>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-4">
        <div className={`grid content-start gap-3 ${active === "books" ? "hidden lg:grid" : ""}`}>
          <div className={active === "tuition" ? "" : INACTIVE_SECTION_CLASS}>
            <TuitionSection {...props} />
          </div>
          <div className={active === "charges" ? "" : INACTIVE_SECTION_CLASS}>
            <ChargesSection {...props} />
          </div>
        </div>
        <div className={active === "books" ? "" : INACTIVE_SECTION_CLASS}>
          <BooksSection {...props} />
        </div>
      </div>
    </div>
  );
}
