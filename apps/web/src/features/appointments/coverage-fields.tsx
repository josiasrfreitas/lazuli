import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { MakeupCoverageInput } from "@lazuli/validators";
import type { Absence } from "./shared";
import { CoverageList } from "./coverage-list";

type CoverageFieldsProps = {
  sources: Absence[];
  value: MakeupCoverageInput[];
  onChange: (value: MakeupCoverageInput[]) => void;
  error?: string | undefined;
  loading?: boolean;
  compact?: boolean;
};

export function CoverageFields({
  sources,
  value,
  onChange,
  error,
  loading = false,
  compact = false,
}: CoverageFieldsProps): ReactJSX.Element {
  const selected = new Set(value.map((row) => row.attendanceId));
  const [page, setPage] = useState(0);
  const available = sources.filter((row) => row.available > 0 || selected.has(row.id));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(available.length / 2) - 1));
  const visible = compact ? available.slice(currentPage * 2, currentPage * 2 + 2) : available;
  return (
    <fieldset
      className="grid min-w-0 gap-3"
      aria-busy={loading || undefined}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? "coverage-error" : undefined}
    >
      <CoverageLegend />
      <p className="text-caption text-muted-foreground">
        Selecione a falta e os minutos que este atendimento vai repor. O saldo considera outras
        reposições agendadas.
      </p>
      <CoverageList
        sources={sources}
        visible={visible}
        value={value}
        onChange={onChange}
        error={error}
        compact={compact}
        loading={loading}
      />
      <CoverageFooter
        compact={compact}
        availableCount={available.length}
        currentPage={currentPage}
        setPage={setPage}
        value={value}
      />
      {error && (
        <p id="coverage-error" role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function CoverageLegend(): ReactJSX.Element {
  return (
    <legend className="mb-2 text-sm font-semibold">
      <span className="inline-flex items-center gap-2">
        <ListChecks className="size-4" aria-hidden="true" />
        Faltas de origem
      </span>
    </legend>
  );
}

function CoverageFooter({
  compact,
  availableCount,
  currentPage,
  setPage,
  value,
}: {
  compact: boolean;
  availableCount: number;
  currentPage: number;
  setPage: (page: number) => void;
  value: MakeupCoverageInput[];
}): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
      {compact && availableCount > 2 && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {currentPage * 2 + 1}–{Math.min(currentPage * 2 + 2, availableCount)} de{" "}
            {availableCount} faltas
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Faltas anteriores"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Mais faltas"
            disabled={currentPage * 2 + 2 >= availableCount}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
      <span className="text-muted-foreground">Total selecionado</span>
      <strong className="font-numeric tabular-nums">
        {value.reduce((sum, row) => sum + row.minutes, 0)} min
      </strong>
    </div>
  );
}
