"use client";

import { useDeferredValue, useState, type ReactElement, type ReactNode } from "react";
import { Field, FieldError, Label, SearchSelect, type SearchSelectOption } from "@lazuli/ui";
import { detectPersonDocument } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";

export type ContractPartyOption = SearchSelectOption & {
  documentType?: string | null;
  phone?: string | null;
  email?: string | null;
};

type PartyPickerProps = {
  kind: "student" | "payer";
  value: SearchSelectOption | null;
  draftValue?: SearchSelectOption | null | undefined;
  onChange: (value: ContractPartyOption | null) => void;
  onClear: () => void;
  onCreate: (query: string) => void;
  onSearchChange: (query: string) => void;
  createMode?: boolean | undefined;
  draftName?: string | undefined;
  endAdornment?: ReactNode;
  showAdornment?: boolean;
  error?: string | undefined;
};

type PartyRow = {
  id: string;
  name: string;
  document?: string | null;
  detail?: string | null;
  documentType?: string | null;
  phone?: string | null;
  email?: string | null;
};

function toOption(row: PartyRow): ContractPartyOption {
  const description = row.detail ?? row.document;
  return {
    id: row.id,
    label: row.name,
    ...(row.document ? { document: detectPersonDocument(row.document).documentNumber } : {}),
    ...(description ? { description } : {}),
    ...(row.documentType === undefined ? {} : { documentType: row.documentType }),
    ...(row.phone === undefined ? {} : { phone: row.phone }),
    ...(row.email === undefined ? {} : { email: row.email }),
  };
}

function usePartyOptions(
  kind: PartyPickerProps["kind"],
  search: string,
): {
  options: ContractPartyOption[];
  pending: boolean;
  failed: boolean;
} {
  const deferred = useDeferredValue(search);
  const results = trpc.finance.searchContractParties.useQuery({ query: deferred });
  const pending = results.isFetching || search !== deferred;
  const rows = kind === "student" ? results.data?.students : results.data?.payers;
  return {
    options: pending ? [] : (rows ?? []).map((row) => toOption(row)),
    pending,
    failed: results.isError,
  };
}

function PickerInput(
  props: PartyPickerProps & {
    search: string;
    setSearch: (value: string) => void;
    selected: SearchSelectOption | null;
    setSelected: (value: SearchSelectOption | null) => void;
  },
): ReactElement {
  const { options, pending, failed } = usePartyOptions(props.kind, props.search);
  const selectedValue =
    props.draftValue ??
    (props.value && props.selected?.id === props.value.id ? props.selected : props.value);
  return (
    <SearchSelect
      name={`${props.kind}Search`}
      resultsOnly={props.kind === "payer"}
      minQueryLength={props.kind === "payer" ? 1 : 0}
      placeholder={`Digite o nome do ${props.kind === "student" ? "aluno" : "pagador"}`}
      query={props.createMode ? (props.draftName ?? props.search) : props.search}
      value={selectedValue}
      onClear={() => {
        props.setSearch("");
        props.setSelected(null);
        props.onClear();
      }}
      options={options}
      loading={pending}
      failed={failed}
      invalid={Boolean(props.error)}
      onQueryChange={(query) => {
        props.setSearch(query);
        props.onChange(null);
        props.onSearchChange(query);
      }}
      onSelect={(option) => {
        props.setSelected(option);
        props.onChange(options.find((result) => result.id === option.id) ?? option);
        props.setSearch("");
      }}
      onCreate={props.onCreate}
    />
  );
}

export function PartyPicker({
  kind,
  value,
  draftValue,
  onChange,
  onClear,
  onCreate,
  onSearchChange,
  createMode = false,
  draftName,
  endAdornment,
  showAdornment = false,
  error,
}: PartyPickerProps): ReactElement {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SearchSelectOption | null>(null);
  const label = kind === "student" ? "Aluno" : "Pagador";
  return (
    <Field name={`${kind}Search`}>
      <Label>{createMode ? `Nome do ${label.toLowerCase()}` : label}</Label>
      <div className={pickerClass({ showAdornment, endAdornment, value, draftValue })}>
        <PickerInput
          {...{
            kind,
            value,
            draftValue,
            onChange,
            onClear,
            onCreate,
            onSearchChange,
            createMode,
            draftName,
            error,
            search,
            setSearch,
            selected,
            setSelected,
          }}
        />
        {showAdornment && endAdornment && (
          <div className="absolute inset-y-0 right-2 flex items-center">{endAdornment}</div>
        )}
      </div>
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}

function pickerClass({
  showAdornment,
  endAdornment,
  value,
  draftValue,
}: Pick<PartyPickerProps, "showAdornment" | "endAdornment" | "value" | "draftValue">): string {
  if (!showAdornment || !endAdornment) return "relative";
  return value || draftValue ? "relative pr-11" : "relative [&_input]:pr-11";
}
