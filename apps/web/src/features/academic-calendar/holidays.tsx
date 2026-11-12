"use client";
import { useState } from "react";
import { Button, Checkbox, FormRow } from "@lazuli/ui";
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
}: {
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
  const exists = (key: string, date: string) =>
    data.interruptions.some((row) => row.sourceKey === key) ||
    data.closedDays.some((row) => row.date.toISOString().slice(0, 10) === date);
  const selected = (query.data?.days ?? []).filter(
    (row) => !excluded.includes(row.sourceKey) && !exists(row.sourceKey, row.date),
  );
  if (change && preview.data)
    return (
      <CalendarImpact
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
      compactHeader
      actionSize="sm"
      title="Buscar feriados"
      description="Confira as sugestões e escolha os dias sem atividades."
      formId="calendar-holidays"
      firstField="holiday-year"
      submitLabel={`Conferir ${selected.length} datas`}
      submitDisabled={!selected.length || query.isPending}
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
          <FormRow columns={2}>
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
          </FormRow>
          {query.isPending && <p role="status">Buscando feriados…</p>}
          {query.error && (
            <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          )}
          {query.data && (
            <>
              <p className="text-caption text-muted-foreground">
                {query.data.source}. Confira também os pontos facultativos e as regras da sua
                escola.
              </p>
              <ul className="divide-y divide-border">
                {query.data.days.map((row) => {
                  const registered = exists(row.sourceKey, row.date);
                  return (
                    <li key={row.sourceKey}>
                      <label className="flex cursor-pointer items-center gap-3 py-2">
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
                          <span className="block">{row.title}</span>
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
                Feriados municipais e datas próprias da escola podem ser cadastrados em Novo
                recesso.
              </p>
            </>
          )}
        </fieldset>
      </form>
    </TaskDialog>
  );
}
