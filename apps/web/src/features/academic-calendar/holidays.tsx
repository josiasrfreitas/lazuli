"use client";
import { RotateCcw } from "lucide-react";
import styles from "./configuration.module.css";
import { useEffect, useState } from "react";
import { Button, Checkbox, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TaskDialog } from "~/features/shared/task-form";
import { SelectControl } from "~/features/classes/form-controls";
import { formatDateOnlyBR } from "~/lib/format";
import { CalendarImpact } from "./impact";
import type { CalendarChange } from "./change-form";
import type { AcademicYear } from "./model";
const states =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
export function CalendarHolidays({
  year: initialYear,
  data,
  onClose,
  embedded = false,
  onPendingChange,
  onBack,
}: {
  embedded?: boolean;
  onPendingChange?: ((pending: boolean) => void) | undefined;
  onBack?: (() => void) | undefined;
  year: number;
  data: AcademicYear;
  onClose: () => void;
}) {
  const [year, setYear] = useState(initialYear);
  const [state, setState] = useState("BR");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [change, setChange] = useState<CalendarChange | null>(null);
  const query = trpc.calendar.academic.holidays.useQuery(
    { year, state: state === "BR" ? "" : state },
    { retry: false, staleTime: 3600000 },
  );
  const preview = trpc.calendar.academic.changes.preview.useMutation();
  useEffect(() => {
    onPendingChange?.(preview.isPending);
    return () => onPendingChange?.(false);
  }, [preview.isPending, onPendingChange]);
  const exists = (key: string, date: string) =>
    data.interruptions.some((row) => row.sourceKey === key) ||
    data.closedDays.some((row) => row.date.toISOString().slice(0, 10) === date);
  const selected = (query.data?.days ?? []).filter(
    (row) => !excluded.includes(row.sourceKey) && !exists(row.sourceKey, row.date),
  );
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
      submitLabel={
        query.isPending
          ? "Buscando feriados…"
          : selected.length
            ? `Conferir ${selected.length} datas`
            : query.data?.days.every((row) => exists(row.sourceKey, row.date))
              ? "Todos cadastrados"
              : "Selecione as datas"
      }
      submitDisabled={!selected.length || query.isPending}
      pendingLabel="Conferindo impactos…"
      pending={preview.isPending}
      onClose={onClose}
      error={preview.error?.message ?? query.error?.message}
    >
      <form
        id="calendar-holidays"
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selected.length || preview.isPending) return;
          const value: CalendarChange = { action: "holidays", dates: selected };
          setChange(value);
          preview.mutate(value);
        }}
      >
        <fieldset disabled={preview.isPending} className="grid min-w-0 gap-4">
          <div className={styles.filters}>
            <SelectControl
              name="holiday-year"
              label="Ano"
              value={String(year)}
              onChange={(value) => {
                setYear(Number(value));
                setExcluded([]);
              }}
              choices={Array.from({ length: 101 }, (_, index) => ({
                value: String(2000 + index),
                label: String(2000 + index),
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
          {query.isPending && (
            <div role="status" aria-label="Buscando feriados" className={styles.holidays}>
              {Array.from({ length: 15 }, (_, index) => (
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
          {query.data && (
            <>
              <ul className={styles.holidays}>
                {query.data.days.map((row) => {
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
                  {query.data.stateCovered ? (
                    <>
                      Inclui o feriado estadual de 8 de julho, conforme o{" "}
                      <a
                        className="text-interactive underline"
                        href={query.data.stateSource!}
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
                Fonte: {query.data.source}. Revise os pontos facultativos. Datas municipais e da
                escola: Novo recesso.
              </p>
            </>
          )}
        </fieldset>
      </form>
    </TaskDialog>
  );
}
