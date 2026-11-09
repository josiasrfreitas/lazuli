"use client";

import { type ReactElement } from "react";
import { CircleCheck, Search, Tags } from "lucide-react";
import { Input, TableFilters, type TableFilterField } from "@lazuli/ui";
import { orderKindSchema } from "@lazuli/validators";
import { useSearchDraft } from "~/lib/use-search-draft";
import { trpc } from "~/lib/trpc";
import {
  INSTALLMENT_STATUSES,
  INSTALLMENT_STATUS_LABELS,
  SEARCH_MAX_LENGTH,
  situationPatch,
  type InstallmentFilters,
  type InstallmentFilterPatch,
} from "./filters";
import { originLabel } from "./view-model";

function SearchField({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (value: string) => void;
}): ReactElement {
  const [value, setValue] = useSearchDraft(search, onSearch);
  return (
    <div className="relative w-full sm:w-44 lg:w-64 2xl:w-80">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-icon"
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
        }}
      />
    </div>
  );
}

function situationField(input: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): TableFilterField {
  return {
    id: "situations",
    label: "Situação",
    kind: "options",
    icon: CircleCheck,
    promoted: true,
    options: INSTALLMENT_STATUSES.map((id) => ({
      id,
      label: INSTALLMENT_STATUS_LABELS[id],
    })),
    selected: input.filters.status === "vencidas" ? ["OVERDUE"] : input.filters.situations,
    onChange: (values) => input.onFilters(situationPatch(values)),
    onClear: () => input.onFilters(situationPatch([])),
  };
}

function dueField(input: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): TableFilterField {
  return {
    id: "due",
    label: "Vencimento",
    kind: "period",
    promoted: true,
    from: input.filters.dueFrom,
    to: input.filters.dueTo,
    onChange: (from, to) => {
      if (from && to && from > to) {
        if (from === input.filters.dueFrom) from = "";
        else to = "";
      }
      input.onFilters({ dueFrom: from || null, dueTo: to || null });
    },
    onClear: () => input.onFilters({ dueFrom: null, dueTo: null }),
  };
}

function originField(input: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): TableFilterField {
  return {
    id: "origins",
    label: "Origem",
    kind: "options",
    icon: Tags,
    promoted: true,
    options: orderKindSchema.options.map((id) => ({ id, label: originLabel(id) })),
    selected: input.filters.origins,
    onChange: (values) => input.onFilters({ origins: values.join(",") || null }),
    onClear: () => input.onFilters({ origins: null }),
  };
}

function amountField(input: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): TableFilterField {
  return {
    id: "amount",
    label: "Valor (R$)",
    kind: "amount",
    from: input.filters.amountFrom,
    to: input.filters.amountTo,
    onChange: (from, to) => {
      if (from && to && Number(from) > Number(to)) {
        if (from === input.filters.amountFrom) from = "";
        else to = "";
      }
      input.onFilters({ amountFrom: from || null, amountTo: to || null });
    },
    onClear: () => input.onFilters({ amountFrom: null, amountTo: null }),
  };
}

export function InstallmentsControls({
  search,
  filters,
  onSearch,
  onFilters,
}: {
  search: string;
  filters: InstallmentFilters;
  onSearch: (value: string) => void;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): ReactElement {
  const student = trpc.students.byId.useQuery(
    { id: filters.studentId ?? "" },
    { enabled: Boolean(filters.studentId) },
  );
  const filterFields = [
    ...studentFilterFields({ filters, onFilters, studentName: student.data?.contact.fullName }),
    situationField({ filters, onFilters }),
    originField({ filters, onFilters }),
    dueField({ filters, onFilters }),
    amountField({ filters, onFilters }),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 2xl:gap-3">
      <SearchField search={search} onSearch={onSearch} />
      <TableFilters
        fields={filterFields}
        onClearAll={() =>
          onFilters({
            studentId: null,
            status: null,
            situations: null,
            origins: null,
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

function studentFilterFields({
  filters,
  onFilters,
  studentName,
}: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
  studentName: string | undefined;
}): TableFilterField[] {
  if (!filters.studentId) return [];
  return [
    {
      id: "student",
      label: "Aluno",
      kind: "options",
      promoted: true,
      options: [{ id: filters.studentId, label: studentName ?? "Aluno selecionado" }],
      selected: [filters.studentId],
      onChange: (values) => onFilters({ studentId: values[0] ?? null }),
      onClear: () => onFilters({ studentId: null }),
    },
  ];
}
