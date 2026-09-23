import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Search } from "lucide-react";
import { Input, TableFilters, type TableFilterField } from "@lazuli/ui";
import { debounce } from "~/lib/debounce";
import {
  INSTALLMENT_STATUSES,
  SEARCH_MAX_LENGTH,
  situationPatch,
  type InstallmentFilters,
  type InstallmentFilterPatch,
} from "./filters";

const SEARCH_DEBOUNCE_MS = 300;
type ControlsProps = {
  search: string;
  filters: InstallmentFilters;
  onSearch: (value: string) => void;
  onFilters: (patch: InstallmentFilterPatch) => void;
};
function SearchField({
  search,
  onSearch,
}: Pick<ControlsProps, "search" | "onSearch">): ReactElement {
  const [value, setValue] = useState(search);
  const location = useSearchParams().toString();
  const commit = useMemo(() => debounce(onSearch, SEARCH_DEBOUNCE_MS), [onSearch]);
  useEffect(() => {
    setValue(search);
    commit.cancel();
  }, [search, location, commit]);
  useEffect(
    () => () => {
      commit.cancel();
    },
    [commit],
  );
  return (
    <div className="relative w-full sm:w-44 lg:w-64 2xl:w-80">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        aria-label="Buscar por pagador ou beneficiário"
        className="pl-8"
        type="search"
        placeholder="Buscar por pagador ou beneficiário"
        maxLength={SEARCH_MAX_LENGTH}
        size="sm"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          commit(event.target.value);
        }}
      />
    </div>
  );
}
function situationField(props: ControlsProps): TableFilterField {
  return {
    id: "situations",
    label: "Situação",
    kind: "options",
    icon: CircleCheck,
    promoted: true,
    options: INSTALLMENT_STATUSES.map((id) => ({
      id,
      label: {
        OVERDUE: "Vencida",
        DUE_THIS_MONTH: "Vence este mês",
        UPCOMING: "A vencer",
        PAID: "Paga",
        WAIVED: "Dispensada",
      }[id],
    })),
    selected: props.filters.status === "vencidas" ? ["OVERDUE"] : props.filters.situations,
    onChange: (values) => props.onFilters(situationPatch(values)),
    onClear: () => props.onFilters(situationPatch([])),
  };
}

function dueField(props: ControlsProps): TableFilterField {
  return {
    id: "due",
    label: "Vencimento",
    kind: "period",
    promoted: true,
    from: props.filters.dueFrom,
    to: props.filters.dueTo,
    onChange: (from, to) => {
      if (from && to && from > to) {
        if (from === props.filters.dueFrom) from = "";
        else to = "";
      }
      props.onFilters({ dueFrom: from || null, dueTo: to || null });
    },
    onClear: () => props.onFilters({ dueFrom: null, dueTo: null }),
  };
}

function amountField(props: ControlsProps): TableFilterField {
  return {
    id: "amount",
    label: "Valor (R$)",
    kind: "amount",
    from: props.filters.amountFrom,
    to: props.filters.amountTo,
    onChange: (from, to) => {
      if (from && to && Number(from) > Number(to)) {
        if (from === props.filters.amountFrom) from = "";
        else to = "";
      }
      props.onFilters({ amountFrom: from || null, amountTo: to || null });
    },
    onClear: () => props.onFilters({ amountFrom: null, amountTo: null }),
  };
}

export function InstallmentsControls(props: ControlsProps): ReactElement {
  const filterFields = [situationField(props), dueField(props), amountField(props)];
  return (
    <div className="flex flex-wrap items-center gap-2 2xl:gap-3">
      <SearchField search={props.search} onSearch={props.onSearch} />
      <TableFilters
        fields={filterFields}
        onClearAll={() =>
          props.onFilters({
            status: null,
            situations: null,
            dueFrom: null,
            dueTo: null,
            amountFrom: null,
            amountTo: null,
          })
        }
      />
    </div>
  );
}
