"use client";
import { useState, type FormEvent, type JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Button, Checkbox } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { TaskDialog } from "~/features/shared/task-form";
import { SelectControl } from "~/features/classes/form-controls";
import { dateOnly, useOrganizationRefresh } from "~/features/semester-organization/shared";
import type { OrganizationDialogProps as Props } from "./dialogs";
import styles from "./organization.module.css";

const ISO_YEAR_LENGTH = 4;
type Holiday = RouterOutputs["semesterOrganization"]["holidays"][number];
type HolidayModel = {
  year: number;
  available: Holiday[];
  selected: Holiday[];
  excluded: string[];
  working: boolean;
  error: string | null;
  query: QueryResult<Holiday[]>;
  changeYear: (value: string) => void;
  toggle: (date: string, checked: boolean) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};

export function HolidayForm(props: Props): ReactJSX.Element {
  const model = useHolidayModel(props);
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Importar feriados"
      description="Sugestões da BrasilAPI. Selecione os dias em que a escola não terá aula."
      formId="organization-holidays"
      firstField="holiday-year"
      submitLabel={model.working ? "Importando…" : `Importar ${model.selected.length} datas`}
      pending={model.working}
      submitDisabled={model.query.isPending || model.selected.length === 0}
      error={model.error ?? model.query.error?.message}
      onClose={props.onClose}
    >
      <HolidayFields board={props.board} model={model} />
    </TaskDialog>
  );
}

function useHolidayModel({ board, onClose, onFeedback }: Props): HolidayModel {
  const [year, setYear] = useState(
    Number(dateOnly(board.semester.startDate).slice(0, ISO_YEAR_LENGTH)),
  );
  const query = trpc.semesterOrganization.holidays.useQuery({ year }, { retry: false });
  const [excluded, setExcluded] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = trpc.semesterOrganization.closeRange.useMutation();
  const refresh = useOrganizationRefresh();
  const { available, selected } = holidayChoices({ board, holidays: query.data ?? [], excluded });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (working) return;
    void importHolidays({
      selected,
      add: add.mutateAsync,
      refresh,
      onFeedback,
      onClose,
      setWorking,
      setError,
    });
  };
  return {
    year,
    query,
    available,
    selected,
    excluded,
    working,
    error,
    submit,
    changeYear: (value) => {
      setYear(Number(value));
      setExcluded([]);
    },
    toggle: (date, checked) =>
      setExcluded((previous) =>
        checked ? previous.filter((item) => item !== date) : [...previous, date],
      ),
  };
}

function holidayChoices({
  board,
  holidays,
  excluded,
}: {
  board: Props["board"];
  holidays: Holiday[];
  excluded: string[];
}): { available: Holiday[]; selected: Holiday[] } {
  const available = holidays.filter(
    (item) =>
      item.date >= dateOnly(board.semester.startDate) &&
      item.date <= dateOnly(board.semester.endDate),
  );
  const selected = available.filter(
    (item) =>
      !excluded.includes(item.date) &&
      !board.closedDays.some((day) => dateOnly(day.date) === item.date),
  );
  return { available, selected };
}

async function importHolidays({
  selected,
  add,
  refresh,
  onFeedback,
  onClose,
  setWorking,
  setError,
}: {
  selected: Holiday[];
  add: (input: {
    from: string;
    through: string;
    reason: string;
  }) => Promise<{ added: number; affected: number }>;
  refresh: () => Promise<void>;
  onFeedback: Props["onFeedback"];
  onClose: Props["onClose"];
  setWorking: (value: boolean) => void;
  setError: (value: string | null) => void;
}): Promise<void> {
  setWorking(true);
  setError(null);
  let added = 0;
  let affected = 0;
  try {
    for (const day of selected) {
      const result = await add({ from: day.date, through: day.date, reason: day.name });
      added += result.added;
      affected += result.affected;
    }
    await refresh();
    onFeedback(
      `${added} feriados importados.${affected ? ` Revise ${affected} aulas já geradas na Agenda.` : ""}`,
    );
    onClose();
  } catch (error_) {
    setError(
      `${added} datas importadas. ${error_ instanceof Error ? error_.message : "Tente novamente."}`,
    );
    await refresh();
  } finally {
    setWorking(false);
  }
}

function HolidayFields({
  board,
  model,
}: {
  board: Props["board"];
  model: HolidayModel;
}): ReactJSX.Element {
  const years = [
    ...new Set([
      dateOnly(board.semester.startDate).slice(0, ISO_YEAR_LENGTH),
      dateOnly(board.semester.endDate).slice(0, ISO_YEAR_LENGTH),
    ]),
  ];
  return (
    <form className={styles.form} id="organization-holidays" onSubmit={model.submit}>
      <SelectControl
        name="holiday-year"
        label="Ano"
        value={String(model.year)}
        onChange={model.changeYear}
        choices={years.map((value) => ({ value, label: value }))}
      />
      {model.query.isPending && (
        <div className={styles.summary} role="status">
          Buscando datas…
        </div>
      )}
      {model.query.error && (
        <Button size="sm" variant="secondary" onClick={() => void model.query.refetch()}>
          Tentar novamente
        </Button>
      )}
      <HolidayRows board={board} model={model} />
      {model.query.data && model.available.length === 0 && (
        <p className={styles.small}>Nenhuma data sugerida dentro deste semestre.</p>
      )}
      <p className={styles.small}>
        Confira o calendário da escola. Feriados de Lagarto e datas próprias podem ser incluídos
        manualmente em “Dia ou intervalo”.
      </p>
    </form>
  );
}

function HolidayRows({
  board,
  model,
}: {
  board: Props["board"];
  model: HolidayModel;
}): ReactJSX.Element {
  return (
    <>
      {model.available.map((day) => (
        <HolidayRow key={day.date} day={day} board={board} model={model} />
      ))}
    </>
  );
}

function HolidayRow({
  day,
  board,
  model,
}: {
  day: Holiday;
  board: Props["board"];
  model: HolidayModel;
}): ReactJSX.Element {
  const exists = board.closedDays.some((item) => dateOnly(item.date) === day.date);
  return (
    <label className={styles.rowStart}>
      <Checkbox
        size="sm"
        checked={exists || !model.excluded.includes(day.date)}
        disabled={exists || model.working}
        onCheckedChange={(value) => model.toggle(day.date, Boolean(value))}
      />
      <span className={styles.person}>
        <strong>{day.name}</strong>
        <span className={styles.small}>
          {formatDateOnlyBR(day.date)}
          {exists ? " · já cadastrado" : ""}
        </span>
      </span>
    </label>
  );
}
