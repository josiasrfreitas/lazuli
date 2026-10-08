"use client";
import { useMemo, useRef, useState, type ReactElement, type RefObject } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Plus, Search } from "lucide-react";
import { Input, type InputSize } from "./input";
import { SelectedTags } from "./search-select-value";

export type SearchSelectOption = {
  id: string;
  label: string;
  description?: string;
  document?: string;
};
const POPUP_OFFSET = 4;

type SearchItem = SearchSelectOption & { kind: "option" | "create" };
export type SearchSelectProps = {
  size?: InputSize;
  name: string;
  placeholder: string;
  showSearchIcon?: boolean;
  value: SearchSelectOption | null;
  query: string;
  options: readonly SearchSelectOption[];
  onQueryChange: (query: string) => void;
  onSelect: (option: SearchSelectOption) => void;
  onClear: () => void;
  onCreate?: (query: string) => void;
  emptyMessage?: string;
  openOnFocus?: boolean;
  loading?: boolean;
  failed?: boolean;
  invalid?: boolean;
  disabled?: boolean;
};

function SearchResults({ items, loading, failed, emptyMessage }: SearchResultsInput): ReactElement {
  return (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={POPUP_OFFSET} className="z-50">
        <Combobox.Popup className="w-(--anchor-width) rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {loading && (
            <p role="status" className="p-2 text-caption">
              Buscando…
            </p>
          )}
          {failed && (
            <p role="alert" className="p-2 text-caption text-destructive">
              Busca indisponível. Tente novamente.
            </p>
          )}
          {!loading && !failed && items.length === 0 && (
            <p role="status" className="p-2 text-caption text-muted-foreground">
              {emptyMessage}
            </p>
          )}
          <SearchResultItems items={items} loading={loading} />
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}

function SearchResultItems({
  items,
  loading,
}: {
  items: readonly SearchItem[];
  loading: boolean;
}): ReactElement {
  return (
    <Combobox.List className="scrollbar-subtle max-h-60 overflow-y-auto">
      {items.map((item, index) => (
        <Combobox.Item
          key={`${item.kind}:${item.id}`}
          value={item}
          index={index}
          disabled={loading && item.kind === "option"}
          className="flex cursor-default flex-col rounded-sm px-2 py-2 text-control outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-disabled"
        >
          <span className="flex items-center gap-2">
            {item.kind === "create" && <Plus aria-hidden="true" className="size-4" />}
            {item.label}
          </span>
          {item.description && (
            <span className="text-caption text-muted-foreground">{item.description}</span>
          )}
        </Combobox.Item>
      ))}
    </Combobox.List>
  );
}

function searchItems(options: readonly SearchSelectOption[], allowCreate: boolean): SearchItem[] {
  return [
    ...options.map((option) => ({ ...option, kind: "option" as const })),
    ...(allowCreate ? [{ kind: "create" as const, id: "", label: "Cadastrar novo" }] : []),
  ];
}

function SearchInput({ props, open, close, highlighted }: SearchInputInput): ReactElement {
  return (
    <div className="relative">
      {props.showSearchIcon && (
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <Combobox.Input
        name={props.name}
        render={
          <Input
            size={props.size ?? "sm"}
            invalid={props.invalid ?? false}
            className={props.showSearchIcon ? "pl-9" : undefined}
          />
        }
        placeholder={props.placeholder}
        onFocus={() => {
          if (props.openOnFocus) open();
        }}
        onChange={(event) => {
          highlighted.current = undefined;
          props.onQueryChange(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          // Let Base UI select the item reached with the arrow keys.
          if (highlighted.current) return;
          event.preventDefault();
          event.preventBaseUIHandler();
          if (!props.loading && props.options[0]) props.onSelect(props.options[0]);
          else if (!props.loading) props.onCreate?.(props.query);
          close();
        }}
      />
    </div>
  );
}

/** Server-filtered results with optional creation. Enter selects a result without submitting. */
export function SearchSelect(props: SearchSelectProps): ReactElement {
  const { value, query, options, loading = false, failed = false } = props;
  const [open, setOpen] = useState(false);
  const highlighted = useRef<SearchItem | undefined>(undefined);
  const allowCreate = props.onCreate !== undefined;
  const items = useMemo(() => searchItems(options, allowCreate), [options, allowCreate]);
  if (value) return <SelectedSearchValue {...props} value={value} />;
  return (
    <Combobox.Root<SearchItem>
      autoHighlight
      open={open}
      onOpenChange={(next) => {
        highlighted.current = undefined;
        setOpen(next);
      }}
      onItemHighlighted={(item) => {
        highlighted.current = item;
      }}
      autoComplete="off"
      disabled={props.disabled}
      filter={null}
      items={items}
      value={null}
      inputValue={query}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(item, selected) =>
        item.kind === selected.kind && item.id === selected.id
      }
      onValueChange={(item) => {
        if (!item) return;
        if (item.kind === "create") props.onCreate?.(query);
        else if (!loading) props.onSelect(item);
      }}
    >
      <SearchInput
        props={props}
        open={() => setOpen(true)}
        close={() => setOpen(false)}
        highlighted={highlighted}
      />
      <SearchResults
        items={items}
        loading={loading}
        failed={failed}
        emptyMessage={props.emptyMessage ?? "Nenhum resultado encontrado."}
      />
    </Combobox.Root>
  );
}

function SelectedSearchValue(
  props: SearchSelectProps & { value: SearchSelectOption },
): ReactElement {
  return (
    <SelectedTags
      touchSized={props.size === "compact-responsive"}
      value={props.value}
      onClear={props.onClear}
      disabled={props.disabled}
    />
  );
}

type SearchResultsInput = {
  items: readonly SearchItem[];
  loading: boolean;
  failed: boolean;
  emptyMessage: string;
};
type SearchInputInput = {
  props: SearchSelectProps;
  open: () => void;
  close: () => void;
  highlighted: RefObject<SearchItem | undefined>;
};
