"use client";

import { useDeferredValue, useState, type ReactElement, type ReactNode } from "react";
import { Field, FieldError, Label, SearchSelect, type SearchSelectOption } from "@lazuli/ui";
import { detectPersonDocument } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";

type PartyPickerProps = {
  kind: "student" | "payer";
  value: SearchSelectOption | null;
  onChange: (value: SearchSelectOption | null) => void;
  onClear: () => void;
  onCreate: (query: string) => void;
  onSearchChange: (query: string) => void;
  createMode?: boolean | undefined;
  draftName?: string | undefined;
  endAdornment?: ReactNode;
  showAdornment?: boolean;
  error?: string | undefined;
};

type PartyRow = { id: string; name: string; document?: string | null; detail?: string | null };

function toOption(row: PartyRow): SearchSelectOption {
  const description = row.detail ?? row.document;
  return {
    id: row.id,
    label: row.name,
    ...(row.document ? { document: detectPersonDocument(row.document).documentNumber } : {}),
    ...(description ? { description } : {}),
  };
}

function usePartyOptions(
  kind: PartyPickerProps["kind"],
  search: string,
): {
  options: SearchSelectOption[];
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
  return (
    <SearchSelect
      name={`${props.kind}Search`}
      placeholder={`Digite o nome do ${props.kind === "student" ? "aluno" : "pagador"}`}
      query={props.createMode ? (props.draftName ?? props.search) : props.search}
      value={props.value && props.selected?.id === props.value.id ? props.selected : props.value}
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
        props.onChange(option);
        props.setSearch("");
      }}
      onCreate={props.onCreate}
    />
  );
}

export function PartyPicker({
  kind,
  value,
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
      <div className={showAdornment && endAdornment ? "relative [&_input]:pr-11" : "relative"}>
        <PickerInput
          {...{
            kind,
            value,
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
