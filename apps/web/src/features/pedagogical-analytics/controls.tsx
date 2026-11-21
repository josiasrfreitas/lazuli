import type { ReactElement } from "react";
import { normalizeSearch } from "@lazuli/domain";
import { Children, createContext, useContext, useState, type ReactNode } from "react";
import { SearchSelect, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import styles from "./pedagogical.module.css";

export function Choices<T extends string>({
  label,
  value,
  choices,
  change,
}: {
  label: string;
  value: T;
  choices: Record<T, string>;
  change: (value: T) => void;
}): ReactElement {
  return (
    <div className={styles.choices}>
      <SegmentedControl
        size="sm"
        aria-label={label}
        value={value}
        onValueChange={(value) => {
          if (value && Object.hasOwn(choices, value)) change(value as T);
        }}
      >
        {Object.entries<string>(choices).map(([key, name]) => (
          <SegmentedControlItem key={key} value={key}>
            {name}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </div>
  );
}
type Option = { id: string; label: string };
export function Picker({
  label,
  value,
  options,
  change,
}: {
  label: string;
  value: string;
  options: Option[];
  change: (id: string) => void;
}): ReactElement {
  const [query, setQuery] = useState("");
  const current = options.find((option) => option.id === value)?.label;
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <SearchSelect
        name={label}
        placeholder={current ?? `Buscar ${label.toLocaleLowerCase("pt-BR")}`}
        showSearchIcon
        openOnFocus
        value={null}
        query={query}
        options={options.filter((option) =>
          normalizeSearch(option.label).includes(normalizeSearch(query)),
        )}
        onQueryChange={setQuery}
        onSelect={(option) => {
          change(option.id);
          setQuery("");
        }}
        onClear={() => {
          setQuery("");
        }}
        emptyMessage="Nenhum resultado."
      />
    </label>
  );
}
export function ChartPanel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={styles.panel}>
      <header>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}

export const LayoutContext = createContext<"overview" | "history" | "detail">("overview");

export function ChartLayout({
  children,
  chartIndex = 0,
}: {
  children: ReactNode;
  chartIndex?: number;
}): ReactElement {
  const layout = useContext(LayoutContext);
  const panels = Children.toArray(children);
  const first = layout === "detail" ? panels.length - 1 : chartIndex;
  if (layout !== "overview") panels.unshift(...panels.splice(first, 1));
  return <div className={styles.dashboard}>{panels}</div>;
}
