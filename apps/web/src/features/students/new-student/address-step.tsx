import { useEffect, useRef, type ReactElement } from "react";
import {
  ToastAlert,
  Field,
  FormRow,
  FormSection,
  Input,
  Label,
  SearchSelect,
  SelectionValue,
} from "@lazuli/ui";
import { useAddressLookup, type AddressLookup } from "./address-lookup";
import type { AddressFields } from "./reducer";

const EMPTY: AddressFields = {
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
};
const FIELDS = {
  street: ["Rua ou avenida", "Ex.: Rua das Flores"],
  number: ["Número", "Ex.: 120 ou s/n"],
  complement: ["Complemento", "Ex.: Apto. 201, bloco B"],
  neighborhood: ["Bairro", "Ex.: Centro"],
  city: ["Cidade", "Ex.: Maceió"],
  state: ["UF", "Ex.: AL"],
  postalCode: ["CEP", "00000-000"],
} as const;
const MIN_ADDRESS_QUERY_LENGTH = 3;
const POSTAL_CODE_LENGTH = 8;
const MAX_POSTAL_INPUT_LENGTH = 9;
const MAX_ADDRESS_LENGTH = 200;

function fieldLimit(name: keyof AddressFields): number {
  if (name === "state") return 2;
  if (name === "postalCode") return MAX_POSTAL_INPUT_LENGTH;
  return MAX_ADDRESS_LENGTH;
}

function normalizeAddressField(name: keyof AddressFields, text: string): string {
  if (name === "state") return text.replaceAll(/[^a-z]/gi, "").toUpperCase();
  if (name === "postalCode")
    return text
      .replaceAll(/\D/g, "")
      .slice(0, POSTAL_CODE_LENGTH)
      .replaceAll(/^(\d{5})(\d)/g, "$1-$2");
  return text;
}

function AddressField({
  name,
  address,
  onChange,
  selected = false,
}: {
  selected?: boolean;
  name: keyof AddressFields;
  address: AddressFields;
  onChange: (value: AddressFields) => void;
}): ReactElement {
  return (
    <Field name={`address.${name}`}>
      <Label>{FIELDS[name][0]}</Label>
      {selected && address[name] ? (
        <SelectionValue value={address[name]} />
      ) : (
        <Input
          size="sm"
          name={`address.${name}`}
          autoComplete="off"
          placeholder={FIELDS[name][1]}
          value={address[name]}
          maxLength={fieldLimit(name)}
          inputMode={name === "postalCode" ? "numeric" : "text"}
          onChange={(event) =>
            onChange({ ...address, [name]: normalizeAddressField(name, event.target.value) })
          }
        />
      )}
    </Field>
  );
}

export function AddressStep({
  value,
  onChange,
  onBusyChange,
}: {
  onBusyChange: (busy: boolean) => void;
  value: AddressFields | undefined;
  onChange: (value: AddressFields) => void;
}): ReactElement {
  const address = value ?? EMPTY;
  const root = useRef<HTMLDivElement>(null);
  const revision = useRef(0);
  useEffect(() => {
    root.current?.querySelector<HTMLInputElement>('input[name="address.street"]')?.focus();
    return () => {
      revision.current += 1;
    };
  }, []);
  const lookup = useAddressLookup({ address, onChange, onBusyChange, root, revision });
  function changeField(next: AddressFields): void {
    revision.current += 1;
    onChange(next);
  }
  return (
    <div ref={root} className="grid gap-4">
      <FormSection
        title="Endereço do aluno"
        description="Busque por CEP, rua, bairro, cidade ou parte do endereço. Você também pode preencher manualmente."
      >
        <AddressSearchRow address={address} lookup={lookup} onChange={changeField} />
        <AddressStatus lookup={lookup} />
        <AddressManualFields address={address} onChange={changeField} selected={lookup.selected} />
      </FormSection>
    </div>
  );
}

function AddressSearchRow({
  address,
  lookup,
  onChange,
}: {
  address: AddressFields;
  lookup: AddressLookup;
  onChange: (value: AddressFields) => void;
}): ReactElement {
  return (
    <FormRow className="sm:grid-cols-[minmax(0,1fr)_10rem]">
      <Field name="address.street">
        <Label>Rua ou avenida</Label>
        <SearchSelect
          name="address.street"
          placeholder="Digite a rua, CEP ou parte do endereço"
          value={
            lookup.selected
              ? { id: "selected-address", label: address.street || address.city }
              : null
          }
          resultsOnly
          query={lookup.query}
          options={lookup.options}
          minQueryLength={MIN_ADDRESS_QUERY_LENGTH}
          loading={lookup.loading}
          failed={lookup.failed}
          disabled={lookup.resolving}
          emptyMessage=""
          onQueryChange={lookup.changeQuery}
          onSelect={(option) => {
            void lookup.select(option.id);
          }}
          onClear={lookup.clearQuery}
        />
      </Field>
      <AddressField name="number" address={address} onChange={onChange} />
    </FormRow>
  );
}

function AddressStatus({ lookup }: { lookup: AddressLookup }): ReactElement {
  return (
    <>
      {lookup.resolving && (
        <p role="status" className="text-caption text-muted-foreground">
          Carregando endereço…
        </p>
      )}
      {lookup.searchFailed && (
        <ToastAlert variant="warning">
          A busca está indisponível. Você pode preencher o endereço manualmente.
        </ToastAlert>
      )}
      {lookup.message && (
        <p role="status" className="text-caption">
          {lookup.message}
        </p>
      )}
    </>
  );
}

function AddressManualFields({
  address,
  onChange,
  selected,
}: {
  selected: AddressFields | null;
  address: AddressFields;
  onChange: (value: AddressFields) => void;
}): ReactElement {
  return (
    <>
      <FormRow columns={2}>
        <AddressField
          name="complement"
          address={address}
          onChange={onChange}
          selected={Boolean(selected?.complement)}
        />
        <AddressField
          name="neighborhood"
          address={address}
          onChange={onChange}
          selected={Boolean(selected?.neighborhood)}
        />
      </FormRow>
      <FormRow className="sm:grid-cols-[minmax(0,1fr)_5rem_9rem]">
        <AddressField
          name="city"
          address={address}
          onChange={onChange}
          selected={Boolean(selected?.city)}
        />
        <AddressField
          name="state"
          address={address}
          onChange={onChange}
          selected={Boolean(selected?.state)}
        />
        <AddressField
          name="postalCode"
          address={address}
          onChange={onChange}
          selected={Boolean(selected?.postalCode)}
        />
      </FormRow>
    </>
  );
}
