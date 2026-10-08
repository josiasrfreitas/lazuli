"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type RefObject,
} from "react";
import { ChevronDown } from "lucide-react";

import type { FinanceSettingsInput } from "@lazuli/validators";
import { Button, Field, FieldError, FormRow, FormSection, Input, Label } from "@lazuli/ui";

import {
  displaySetting,
  floorLabel,
  loadedFields,
  validateSettings,
  type SettingsErrors,
  type SettingsFields,
  type SettingsRow,
} from "./settings-model";

type SettingsSectionProps = { fields: SettingsFields } & (
  | { readOnly: true }
  | {
      readOnly?: false;
      errors: SettingsErrors;
      disabled: boolean;
      onChange: (name: keyof SettingsFields, value: string) => void;
    }
);

type SettingsFieldProps = SettingsSectionProps & {
  name: keyof SettingsFields;
  label: string;
  unit: string;
  placeholder: string;
  autoFocus?: boolean;
};

function SettingsField(props: SettingsFieldProps): ReactElement {
  const { name, label, unit, fields } = props;
  if (props.readOnly) {
    return (
      <dl className="grid gap-1.5">
        <dt className="text-caption text-muted-foreground">{label}</dt>
        <dd className="font-numeric flex min-h-7 items-center text-base tabular-nums">
          {displaySetting(name, fields[name])}
        </dd>
      </dl>
    );
  }
  return (
    <Field name={name} disabled={props.disabled}>
      <Label>
        {label} <span className="text-muted-foreground">({unit})</span>
      </Label>
      <Input
        aria-required="true"
        autoComplete="off"
        autoFocus={props.autoFocus}
        disabled={props.disabled}
        inputMode="decimal"
        invalid={props.errors[name] !== undefined}
        name={name}
        placeholder={`Ex.: ${props.placeholder}`}
        size="xs"
        type="text"
        value={fields[name]}
        onChange={(event) => props.onChange(name, event.target.value)}
      />
      {props.errors[name] !== undefined && <FieldError match>{props.errors[name]}</FieldError>}
    </Field>
  );
}

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
      <SettingsField
        {...props}
        name="punctualityDiscountPct"
        label="Desconto por pontualidade"
        unit="%"
        placeholder="0"
      />
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

function SettingsSections(props: SettingsSectionProps): ReactElement {
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

export type SettingsMutation = {
  isPending: boolean;
  mutateAsync: (values: FinanceSettingsInput) => Promise<SettingsRow | null>;
};

type SettingsFormProps = {
  row: SettingsRow | null;
  mutation: SettingsMutation;
  onCancel: () => void;
  onSaved: () => void;
};

type FormState = {
  fields: SettingsFields;
  errors: SettingsErrors;
  message: string;
  formRef: RefObject<HTMLFormElement | null>;
  onChange: (name: keyof SettingsFields, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function useSettingsForm({ row, mutation, onSaved }: SettingsFormProps): FormState {
  const [fields, setFields] = useState(() => loadedFields(row));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [message, setMessage] = useState("");
  const [validationAttempt, setValidationAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (validationAttempt > 0)
      formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [validationAttempt]);
  const onChange = (name: keyof SettingsFields, value: string): void => {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  };
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (mutation.isPending) return;
    setMessage("");
    const result = validateSettings(fields);
    if (!result.success) {
      setErrors(result.errors);
      setValidationAttempt((current) => current + 1);
      return;
    }
    setErrors({});
    try {
      const updated = await mutation.mutateAsync(result.values);
      if (updated === null) throw new Error("Settings were not returned after saving");
      onSaved();
    } catch {
      setMessage("Não foi possível salvar. Seus valores foram mantidos.");
    }
  }
  return { fields, errors, message, formRef, onChange, submit };
}

export function SettingsForm(input: SettingsFormProps): ReactElement {
  const { mutation, onCancel } = input;
  const form = useSettingsForm(input);
  return (
    <form
      ref={form.formRef}
      noValidate
      aria-label="Ajustes financeiros"
      onSubmit={(event) => void form.submit(event)}
    >
      <SettingsSections
        fields={form.fields}
        errors={form.errors}
        disabled={mutation.isPending}
        onChange={form.onChange}
      />
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
        {form.message && (
          <p role="alert" className="w-full text-caption text-destructive">
            {form.message}
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 sm:min-h-0"
          disabled={mutation.isPending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          className="min-h-11 sm:min-h-0"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function UpdateCredit({ row }: { row: SettingsRow | null }): ReactElement {
  if (row === null) return <p>Ainda não configurado.</p>;
  const date = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(row.updatedAt);
  return (
    <p>
      Atualizado em {date}
      <br />
      por {row.updatedByName ?? "autor desconhecido"}.
    </p>
  );
}

type SettingsPanelProps = {
  row: SettingsRow | null;
  mutation: SettingsMutation;
};

export function SettingsPanel({ row, mutation }: SettingsPanelProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const hasEdited = useRef(false);
  useEffect(() => {
    if (!editing && hasEdited.current) editRef.current?.focus();
  }, [editing]);
  return (
    <div className="rounded-md border border-border bg-card">
      {editing ? (
        <SettingsForm
          row={row}
          mutation={mutation}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
        />
      ) : (
        <>
          <SettingsSections fields={loadedFields(row)} readOnly />
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div className="text-caption text-muted-foreground">
              {saved && <p role="status">Ajustes salvos.</p>}
              <UpdateCredit row={row} />
            </div>
            <Button
              ref={editRef}
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11 sm:min-h-0"
              onClick={() => {
                hasEdited.current = true;
                setSaved(false);
                setEditing(true);
              }}
            >
              {row === null ? "Configurar" : "Editar"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
