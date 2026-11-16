"use client";
import { RotateCcw } from "lucide-react";
import styles from "./configuration.module.css";
import { useEffect, useState, type ReactElement, type Dispatch, type SetStateAction } from "react";
import { Button, Checkbox, InlineSkeleton } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { TaskDialog } from "~/features/shared/task-form";
import { SelectControl } from "~/features/classes/form-controls";
import { formatDateOnlyBR } from "~/lib/format";
import { CalendarImpact } from "./impact";
import type { CalendarChange } from "./change-form";
import type { AcademicYear } from "./model";
const states =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const HOLIDAY_STALE_TIME = 3_600_000;
const DATE_LENGTH = 10;
const MIN_YEAR = 2000;
type HolidaysProps = {
  embedded?: boolean;
  onPendingChange?: ((pending: boolean) => void) | undefined;
  onBack?: (() => void) | undefined;
  year: number;
  data: AcademicYear;
  onClose: () => void;
};
type HolidayResult = RouterOutputs["calendar"]["academic"]["holidays"];
type HolidayState = {
  year: number;
  setYear: Dispatch<SetStateAction<number>>;
  state: string;
  setState: Dispatch<SetStateAction<string>>;
  excluded: string[];
  setExcluded: Dispatch<SetStateAction<string[]>>;
  change: CalendarChange | null;
  setChange: Dispatch<SetStateAction<CalendarChange | null>>;
  query: QueryResult<HolidayResult>;
  preview: ReturnType<typeof trpc.calendar.academic.changes.preview.useMutation>;
  exists: (key: string, date: string) => boolean;
  selected: HolidayResult["days"];
};
type HolidayViewProps = { props: HolidaysProps; state: HolidayState };
export function CalendarHolidays(props: HolidaysProps): ReactElement {
  const state = useHolidays(props);
  const { change, preview, setChange } = state;
  const { embedded = false, onPendingChange, onClose } = props;
  if (change && preview.data)
    return (
      <CalendarImpact
        embedded={embedded}
        onPendingChange={onPendingChange}
        change={change}
        preview={preview.data}
        onClose={onClose}
        onBack={() => {
          setChange(null);
          preview.reset();
        }}
      />
    );
  return <HolidayDialog props={props} state={state} />;
}
function useHolidays({ year: initialYear, data, onPendingChange }: HolidaysProps): HolidayState {
  const [year, setYear] = useState(initialYear);
  const [state, setState] = useState("BR");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [change, setChange] = useState<CalendarChange | null>(null);
  const query = trpc.calendar.academic.holidays.useQuery(
    { year, state: state === "BR" ? "" : state },
    { retry: false, staleTime: HOLIDAY_STALE_TIME },
  );
  const preview = trpc.calendar.academic.changes.preview.useMutation();
  useEffect(() => {
    onPendingChange?.(preview.isPending);
    return () => onPendingChange?.(false);
  }, [preview.isPending, onPendingChange]);
  const exists = (key: string, date: string): boolean =>
    data.interruptions.some((row) => row.sourceKey === key) ||
    data.closedDays.some((row) => row.date.toISOString().slice(0, DATE_LENGTH) === date);
  const selected = (query.data?.days ?? []).filter(
    (row) => !excluded.includes(row.sourceKey) && !exists(row.sourceKey, row.date),
  );
  return {
    year,
    setYear,
    state,
    setState,
    excluded,
    setExcluded,
    change,
    setChange,
    query,
    preview,
    exists,
    selected,
  };
}
function HolidayDialog({
  props: { embedded = false, onBack, onClose },
  state,
}: HolidayViewProps): ReactElement {
  const { query, preview, selected } = state;
  return (
    <TaskDialog
      embedded={embedded}
      hideCancel={embedded}
      onBack={onBack}
      size="extra-wide"
      compactHeader
      actionSize="sm"
      title="Buscar feriados"
      formId="calendar-holidays"
      firstField="holiday-year"
      submitLabel={holidaySubmitLabel(state)}
      submitDisabled={selected.length === 0 || query.isPending}
      pendingLabel="Conferindo impactos…"
      pending={preview.isPending}
      onClose={onClose}
      error={preview.error?.message ?? query.error?.message}
    >
      <HolidayForm state={state} />
    </TaskDialog>
  );
}

function HolidayForm({ state }: { state: HolidayState }): ReactElement {
  const { selected, preview, setChange, query } = state;
  return (
    <form
      id="calendar-holidays"
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (selected.length === 0 || preview.isPending) return;
        const value: CalendarChange = { action: "holidays", dates: selected };
        setChange(value);
        preview.mutate(value);
      }}
    >
      <fieldset disabled={preview.isPending} className="grid min-w-0 gap-4">
        <HolidayFilters state={state} />
        {query.isPending && (
          <div role="status" aria-label="Buscando feriados" className={styles.holidays}>
            {Array.from({ length: 15 }, (_value, index) => (
              <div key={index} className={styles.holiday}>
                <InlineSkeleton shape="block" />
                <div className="grid gap-2">
                  <InlineSkeleton className="w-36" />
                  <InlineSkeleton className="w-20" />
                </div>
              </div>
            ))}
          </div>
        )}
        {query.error && (
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
            <RotateCcw aria-hidden="true" /> Tentar novamente
          </Button>
        )}
        {query.data && <HolidayResults result={query.data} state={state} />}
      </fieldset>
    </form>
  );
}

function HolidayFilters({
  state: { year, setYear, setExcluded, state, setState },
}: {
  state: HolidayState;
}): ReactElement {
  return (
    <div className={styles.filters}>
      <SelectControl
        name="holiday-year"
        label="Ano"
        value={String(year)}
        onChange={(value) => {
          setYear(Number(value));
          setExcluded([]);
        }}
        choices={Array.from({ length: 101 }, (_value, index) => ({
          value: String(MIN_YEAR + index),
          label: String(MIN_YEAR + index),
        }))}
      />

      <SelectControl
        name="holiday-state"
        label="Estado"
        value={state}
        onChange={(value) => {
          setState(value);
          setExcluded([]);
        }}
        choices={[
          { value: "BR", label: "Somente nacionais" },
          ...states.map((value) => ({ value, label: value })),
        ]}
      />
    </div>
  );
}

function HolidayResults({
  result,
  state: { exists, excluded, setExcluded, state },
}: {
  result: HolidayResult;
  state: HolidayState;
}): ReactElement {
  return (
    <>
      <ul className={styles.holidays}>
        {result.days.map((row) => {
          const registered = exists(row.sourceKey, row.date);
          return (
            <li key={row.sourceKey}>
              <label className={styles.holiday} data-registered={registered}>
                <Checkbox
                  size="sm"
                  disabled={registered}
                  checked={registered || !excluded.includes(row.sourceKey)}
                  onCheckedChange={(checked) =>
                    setExcluded((current) =>
                      checked
                        ? current.filter((key) => key !== row.sourceKey)
                        : [...current, row.sourceKey],
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="block break-words">{row.title}</span>
                  <span className="text-caption text-muted-foreground">
                    {formatDateOnlyBR(row.date)}
                    {registered ? " · já cadastrado" : ""}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {state !== "BR" && (
        <p className="text-caption text-muted-foreground">
          {result.stateCovered ? (
            <>
              Inclui o feriado estadual de 8 de julho, conforme o{" "}
              <a
                className="text-interactive underline"
                href={result.stateSource!}
                target="_blank"
                rel="noreferrer"
              >
                calendário oficial de Sergipe
              </a>
              .
            </>
          ) : (
            `Não há fonte estadual cadastrada para ${state} neste ano. Inclua as datas estaduais manualmente.`
          )}
        </p>
      )}
      <p className="text-caption text-muted-foreground">
        Fonte: {result.source}. Revise os pontos facultativos. Datas municipais e da escola:
        Adicionar intervalo.
      </p>
    </>
  );
}

function holidaySubmitLabel({ query, selected, exists }: HolidayState): string {
  if (query.isPending) return "Buscando feriados…";
  if (selected.length > 0) return `Conferir ${selected.length} datas`;
  return query.data?.days.every((row) => exists(row.sourceKey, row.date))
    ? "Todos cadastrados"
    : "Selecione as datas";
}
