import type { LucideIcon } from "lucide-react";

export type TableFilterOption = { id: string; label: string };
/** Remote results belong to the current query and contain at most its first 20 matches. */
export type RemoteOptionsResult =
  | { status: "idle"; query: "" }
  | { status: "loading"; query: string }
  | { status: "error"; query: string; onRetry: () => void }
  | { status: "ready"; query: string; options: TableFilterOption[]; hasMore: boolean };
type FilterBase = {
  id: string;
  label: string;
  promoted?: boolean;
  icon?: LucideIcon;
  onClear: () => void;
};
export type TableFilterField = FilterBase &
  (
    | {
        kind: "options";
        options: TableFilterOption[];
        selected: string[];
        onChange: (values: string[]) => void;
        onSearch?: (value: string) => void;
      }
    | {
        kind: "remote-options";
        selected: string[];
        selectedOptions: TableFilterOption[];
        search: string;
        result: RemoteOptionsResult;
        onSearchChange: (value: string) => void;
        onChange: (values: string[]) => void;
      }
    | { kind: "period"; from: string; to: string; onChange: (from: string, to: string) => void }
    | { kind: "amount"; from: string; to: string; onChange: (from: string, to: string) => void }
    | { kind: "toggle"; checked: boolean; onChange: (checked: boolean) => void }
  );

export function summary(field: TableFilterField): string {
  if (field.kind === "toggle") return field.checked ? "Ativo" : "";
  if (field.kind === "options" || field.kind === "remote-options") {
    if (field.selected.length === 0) return "";
    const available = field.kind === "options" ? field.options : field.selectedOptions;
    const labels = field.selected.map(
      (id) => available.find((option) => option.id === id)?.label ?? "Seleção indisponível",
    );
    return labels.length <= 2
      ? labels.join(", ")
      : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }
  if (!field.from && !field.to) return "";
  const display = (value: string): string => {
    if (field.kind === "period") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
    }
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
      : value;
  };
  if (field.from && field.to) return `${display(field.from)} – ${display(field.to)}`;
  return field.from ? `≥ ${display(field.from)}` : `≤ ${display(field.to)}`;
}
