"use client";

import { useMemo, useRef, useState, type ReactElement, type RefObject } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Plus, X } from "lucide-react";
import { Input } from "./input";

export type SearchSelectOption = {
  id: string;
  label: string;
  description?: string;
  document?: string;
};
const POPUP_OFFSET = 4;

type SearchItem = SearchSelectOption & { kind: "option" | "create" };
export type SearchSelectProps = {
  name: string;
  placeholder: string;
  value: SearchSelectOption | null;
  query: string;
  options: readonly SearchSelectOption[];
  onQueryChange: (query: string) => void;
  onSelect: (option: SearchSelectOption) => void;
  onClear: () => void;
  onCreate: (query: string) => void;
  loading?: boolean;
  failed?: boolean;
  invalid?: boolean;
  disabled?: boolean;
};

function SearchResults({
  items,
  loading,
  failed,
}: {
  items: readonly SearchItem[];
  loading: boolean;
  failed: boolean;
}): ReactElement {
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
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}

function searchItems(options: readonly SearchSelectOption[]): SearchItem[] {
  return [
    ...options.map((option) => ({ ...option, kind: "option" as const })),
    { kind: "create", id: "", label: "Cadastrar novo" },
  ];
}

function SearchInput({
  props,
  close,
  highlighted,
}: {
  props: SearchSelectProps;
  close: () => void;
  highlighted: RefObject<SearchItem | undefined>;
}): ReactElement {
  return (
    <Combobox.Input
      name={props.name}
      render={<Input size="sm" invalid={props.invalid ?? false} />}
      placeholder={props.placeholder}
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
        else props.onCreate(props.query);
        close();
      }}
    />
  );
}

function SelectedTags({
  value,
  onClear,
  disabled,
}: {
  value: SearchSelectOption;
  onClear: () => void;
  disabled: boolean | undefined;
}): ReactElement {
  return (
    <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-2">
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm bg-accent px-2 py-1 text-control text-accent-foreground">
        <span className="truncate">{value.label}</span>
        <button
          type="button"
          aria-label={`Remover ${value.label}`}
          disabled={disabled}
          onClick={onClear}
          className="shrink-0 rounded-sm p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:shadow-focus"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </span>
      {value.document && (
        <span className="max-w-full truncate rounded-sm bg-accent px-2 py-1 text-control text-accent-foreground">
          {value.document}
        </span>
      )}
    </div>
  );
}

/** Server-filtered results, followed by creation. Enter selects the first highlighted result. */
export function SearchSelect(props: SearchSelectProps): ReactElement {
  const { value, query, options, loading = false, failed = false } = props;
  const [open, setOpen] = useState(false);
  const highlighted = useRef<SearchItem | undefined>(undefined);
  const items = useMemo(() => searchItems(options), [options]);
  if (value)
    return <SelectedTags value={value} onClear={props.onClear} disabled={props.disabled} />;
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
        if (item.kind === "create") props.onCreate(query);
        else if (!loading) props.onSelect(item);
      }}
    >
      <SearchInput props={props} close={() => setOpen(false)} highlighted={highlighted} />
      <SearchResults items={items} loading={loading} failed={failed} />
    </Combobox.Root>
  );
}
