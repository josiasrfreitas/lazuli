import type { Meta, StoryObj } from "@storybook/nextjs";
import { useEffect, useId, useRef, useState, type ReactElement, type RefObject } from "react";

import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldError,
  FormRow,
  FormSection,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lazuli/ui";

const LOCATIONS = ["Na escola", "Outro local", "Polo Norte", "Polo Sul", "Remoto"];
const LONG_LOCATIONS = [
  "Atendimento presencial na unidade de referência da matrícula",
  "Atendimento excepcional em endereço de responsabilidade da família",
];
const OTHER_LOCATION = "Outro local";
const RUNTIME_DELAY_MS = 320;
const ADDRESS_ERROR =
  "Informe o endereço completo do outro local, incluindo a rua, o número e um ponto de referência para a equipe encontrar o atendimento.";

type Options = "five" | "short" | "runtime" | "long";

function LocationChoice({
  options,
  mode,
  value,
  onChange,
}: {
  options: string[];
  mode: Options;
  value: string | null;
  onChange: (value: string | null) => void;
}): ReactElement {
  const label = useId();
  const segmented = mode === "short";
  return (
    <Field className="min-w-0" name="location">
      <Label id={label}>Local de atendimento</Label>
      {segmented ? (
        <SegmentedControl aria-labelledby={label} size="sm" value={value} onValueChange={onChange}>
          {options.map((option) => (
            <SegmentedControlItem key={option} value={option}>
              {option}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      ) : (
        <Select
          items={options.map((option) => ({ value: option, label: option }))}
          value={value}
          onValueChange={onChange}
        >
          <SelectTrigger aria-labelledby={label} size="sm">
            <SelectValue placeholder="Selecione o local" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

function CityAndState(): ReactElement {
  return (
    <div className="@container">
      <FormRow className="@min-[320px]:grid-cols-[minmax(0,1fr)_5rem]">
        <Field name="city">
          <Label>Cidade</Label>
          <Input name="city" autoComplete="off" placeholder="Ex.: Maceió" size="sm" />
        </Field>
        <Field name="state">
          <Label>UF</Label>
          <Input name="state" autoComplete="off" placeholder="Ex.: AL" size="sm" maxLength={2} />
        </Field>
      </FormRow>
    </div>
  );
}

function availableOptions(mode: Options, runtime: string[] | null): string[] {
  if (mode === "long") return LONG_LOCATIONS;
  if (mode === "five") return LOCATIONS;
  return (mode === "runtime" ? runtime : null) ?? LOCATIONS.slice(0, 2);
}

function AlternateAddress({
  input,
  invalid,
  value,
  onChange,
}: {
  input: RefObject<HTMLInputElement | null>;
  invalid: boolean;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <Field name="address" invalid={invalid}>
      <Label>Endereço do outro local</Label>
      <Input
        ref={input}
        name="address"
        autoComplete="off"
        placeholder="Ex.: Rua das Flores, 120"
        required
        size="sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError match={invalid}>{ADDRESS_ERROR}</FieldError>
    </Field>
  );
}

function LocationForm({
  mode,
  formId,
  firstField,
}: {
  mode: Options;
  formId: string;
  firstField: RefObject<HTMLInputElement | null>;
}): ReactElement {
  const [location, setLocation] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<string[] | null>(null);
  const [address, setAddress] = useState("");
  const [invalid, setInvalid] = useState(false);
  const addressInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "runtime") return;
    // Simulate delivery after opening without depending on an external dataset.
    const task = globalThis.setTimeout(
      () => setRuntime([...LOCATIONS, "Visita"]),
      RUNTIME_DELAY_MS,
    );
    return () => globalThis.clearTimeout(task);
  }, [mode]);

  const addressField = location === OTHER_LOCATION && (
    <AlternateAddress
      input={addressInput}
      invalid={invalid}
      value={address}
      onChange={(value) => {
        setAddress(value);
        setInvalid(false);
      }}
    />
  );

  return (
    <form
      className="grid gap-5"
      id={formId}
      noValidate
      data-options-state={mode === "runtime" && runtime === null ? "loading" : "ready"}
      onSubmit={(event) => {
        event.preventDefault();
        if (location === OTHER_LOCATION && !address.trim()) {
          setInvalid(true);
          addressInput.current?.focus();
        }
      }}
    >
      <FormSection title="Atendimento">
        <Field name="contact">
          <Label>Nome do responsável</Label>
          <Input
            ref={firstField}
            name="contact"
            autoComplete="off"
            placeholder="Ex.: Ana Souza"
            size="sm"
          />
        </Field>
        <LocationChoice
          mode={mode}
          options={availableOptions(mode, runtime)}
          value={location}
          onChange={(value) => {
            setLocation(value);
            setInvalid(false);
          }}
        />
        {addressField}
      </FormSection>
      <FormSection title="Município">
        <CityAndState />
      </FormSection>
    </form>
  );
}

function LayoutPilotDialog({
  mode = "five",
  narrow = false,
}: {
  mode?: Options;
  narrow?: boolean;
}): ReactElement {
  const formId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  return (
    <Dialog>
      <DialogTrigger render={<Button>Novo atendimento</Button>} />
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          initialFocus={firstField}
          className={narrow ? "md:max-w-[17.5rem]" : undefined}
        >
          <DialogHeader>
            <DialogTitle>Novo atendimento</DialogTitle>
          </DialogHeader>
          <DialogBody className="mt-5">
            <LocationForm mode={mode} formId={formId} firstField={firstField} />
          </DialogBody>
          <DialogFooter>
            <Button type="submit" form={formId}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

const meta = {
  title: "Patterns/LayoutQualityPilot",
  component: LayoutPilotDialog,
} satisfies Meta<typeof LayoutPilotDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reference: Story = {};
export const Narrow: Story = { args: { narrow: true } };
export const RuntimeOptions: Story = { args: { mode: "runtime" } };
export const ShortOptions: Story = { args: { mode: "short" } };
export const LongOptions: Story = { args: { mode: "long" } };
