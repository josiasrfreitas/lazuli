"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { Button, Checkbox } from "@lazuli/ui";
import { z, calendarDateSchema, closedDayReasonSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { dateOnly, useOrganizationRefresh } from "~/features/semester-organization/shared";
import type { OrganizationDialogProps as Props } from "./dialogs";
import styles from "./organization.module.css";

const ISO_YEAR_LENGTH = 4;

export function ClosureForm({
  board,
  initialDate,
  onClose,
  onFeedback,
}: Props & { initialDate: string }): ReactJSX.Element {
  const [from, setFrom] = useState(formatDateOnlyBR(initialDate)),
    [through, setThrough] = useState(formatDateOnlyBR(initialDate));
  const existing = board.closedDays.find((item) => dateOnly(item.date) === initialDate);
  const [reason, setReason] = useState(existing?.reason ?? "");
  const validation = useValidation(),
    refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.closeRange.useMutation({
    onSuccess: async (result) => {
      await refresh();
      onFeedback(
        `${result.added} datas incluídas.${result.affected ? ` ${result.affected} aulas já existentes precisam ser revisadas na Agenda.` : " Novas aulas respeitarão este intervalo."}`,
      );
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Dia ou intervalo sem aula"
      description="Feriado local, férias, recesso ou exceção da escola."
      formId="organization-closure"
      firstField="closure-reason"
      submitLabel="Salvar no calendário"
      pending={mutation.isPending}
      onClose={onClose}
      error={mutation.error?.message}
      bodyRef={validation.body}
    >
      <form
        className={styles.form}
        id="organization-closure"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const values = validation.validate(
            z
              .object({
                from: calendarDateSchema,
                through: calendarDateSchema,
                reason: closedDayReasonSchema,
              })
              .refine((input) => input.from <= input.through, {
                path: ["through"],
                message: "O fim deve ser posterior ao início.",
              }),
            { from: parseDateBR(from) ?? "", through: parseDateBR(through) ?? "", reason },
          );
          if (values && !mutation.isPending) mutation.mutate(values);
        }}
      >
        <TextControl
          name="closure-reason"
          label="Motivo"
          placeholder="Ex.: feriado municipal de Lagarto"
          value={reason}
          onChange={setReason}
          error={validation.errors.reason}
        />
        <div className={styles.formRow}>
          <TextControl
            name="closure-from"
            label="De"
            placeholder="dd/mm/aaaa"
            value={from}
            onChange={(value) => {
              setFrom(maskDateBR(value));
              if (through === from) setThrough(maskDateBR(value));
            }}
            inputMode="numeric"
            error={validation.errors.from}
          />
          <TextControl
            name="closure-through"
            label="Até · inclusive"
            placeholder="dd/mm/aaaa"
            value={through}
            onChange={(value) => setThrough(maskDateBR(value))}
            inputMode="numeric"
            error={validation.errors.through}
          />
        </div>
        <p className={styles.small}>
          Use a mesma data para um único dia. Datas já cadastradas serão preservadas. Aulas já
          geradas precisam ser revisadas na Agenda.
        </p>
      </form>
    </TaskDialog>
  );
}

export function PeriodForm({ board, onClose, onFeedback }: Props): ReactJSX.Element {
  const [name, setName] = useState(board.semester.name),
    [start, setStart] = useState(formatDateOnlyBR(dateOnly(board.semester.startDate))),
    [end, setEnd] = useState(formatDateOnlyBR(dateOnly(board.semester.endDate)));
  const validation = useValidation(),
    refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.updatePeriod.useMutation({
    onSuccess: async (result) => {
      await refresh();
      onFeedback(
        `Período atualizado.${result.affected ? ` ${result.affected} aulas ficaram fora do período; revise-as na Agenda.` : " Revise as vigências das propostas pendentes."}`,
      );
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Período letivo"
      description="As datas delimitam a vigência das alocações deste semestre."
      formId="organization-period"
      firstField="period-name"
      submitLabel="Salvar período"
      pending={mutation.isPending}
      onClose={onClose}
      error={mutation.error?.message}
      bodyRef={validation.body}
    >
      <form
        className={styles.form}
        id="organization-period"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const values = validation.validate(
            z.object({
              name: z.string().trim().min(1),
              startDate: calendarDateSchema,
              endDate: calendarDateSchema,
            }),
            { name, startDate: parseDateBR(start) ?? "", endDate: parseDateBR(end) ?? "" },
          );
          if (values && !mutation.isPending)
            mutation.mutate({
              ...values,
              semesterId: board.semester.id,
              previousStart: dateOnly(board.semester.startDate),
              previousEnd: dateOnly(board.semester.endDate),
            });
        }}
      >
        <TextControl
          name="period-name"
          label="Nome"
          placeholder="2027.1"
          value={name}
          onChange={setName}
          error={validation.errors.name}
        />
        <div className={styles.formRow}>
          <TextControl
            name="period-start"
            label="Primeiro dia letivo"
            value={start}
            onChange={(value) => setStart(maskDateBR(value))}
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            error={validation.errors.startDate}
          />
          <TextControl
            name="period-end"
            label="Último dia letivo"
            value={end}
            onChange={(value) => setEnd(maskDateBR(value))}
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            error={validation.errors.endDate}
          />
        </div>
        <div className={styles.summary}>
          <span>Alocações confirmadas mantêm a vigência combinada.</span>
          <span>Férias e recessos são registrados como intervalos sem aula.</span>
        </div>
      </form>
    </TaskDialog>
  );
}

export function HolidayForm({ board, onClose, onFeedback }: Props): ReactJSX.Element {
  const [year, setYear] = useState(
    Number(dateOnly(board.semester.startDate).slice(0, ISO_YEAR_LENGTH)),
  );
  const query = trpc.semesterOrganization.holidays.useQuery({ year }, { retry: false });
  const [excluded, setExcluded] = useState<string[]>([]),
    [working, setWorking] = useState(false),
    [error, setError] = useState<string | null>(null);
  const add = trpc.semesterOrganization.closeRange.useMutation(),
    refresh = useOrganizationRefresh();
  const available = (query.data ?? []).filter(
    (item) =>
      item.date >= dateOnly(board.semester.startDate) &&
      item.date <= dateOnly(board.semester.endDate),
  );
  const selected = available.filter(
    (item) =>
      !excluded.includes(item.date) &&
      !board.closedDays.some((day) => dateOnly(day.date) === item.date),
  );
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Importar feriados"
      description="Sugestões da BrasilAPI. Selecione os dias em que a escola não terá aula."
      formId="organization-holidays"
      firstField="holiday-year"
      submitLabel={working ? "Importando…" : `Importar ${selected.length} datas`}
      pending={working}
      submitDisabled={query.isPending || selected.length === 0}
      error={error ?? query.error?.message}
      onClose={onClose}
    >
      <form
        className={styles.form}
        id="organization-holidays"
        onSubmit={(event) => {
          event.preventDefault();
          if (working) return;
          void (async () => {
            setWorking(true);
            setError(null);
            let added = 0,
              affected = 0;
            try {
              for (const day of selected) {
                const result = await add.mutateAsync({
                  from: day.date,
                  through: day.date,
                  reason: day.name,
                });
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
          })();
        }}
      >
        <SelectControl
          name="holiday-year"
          label="Ano"
          value={String(year)}
          onChange={(value) => {
            setYear(Number(value));
            setExcluded([]);
          }}
          choices={[
            ...new Set([
              dateOnly(board.semester.startDate).slice(0, ISO_YEAR_LENGTH),
              dateOnly(board.semester.endDate).slice(0, ISO_YEAR_LENGTH),
            ]),
          ].map((value) => ({ value, label: value }))}
        />
        {query.isPending && (
          <div className={styles.summary} role="status">
            Buscando datas…
          </div>
        )}
        {query.error && (
          <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        )}
        {available.map((day) => {
          const exists = board.closedDays.some((item) => dateOnly(item.date) === day.date);
          return (
            <label key={day.date} className={styles.rowStart}>
              <Checkbox
                size="sm"
                checked={exists || !excluded.includes(day.date)}
                disabled={exists || working}
                onCheckedChange={(value) =>
                  setExcluded((previous) =>
                    value ? previous.filter((date) => date !== day.date) : [...previous, day.date],
                  )
                }
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
        })}
        {query.data && available.length === 0 && (
          <p className={styles.small}>Nenhuma data sugerida dentro deste semestre.</p>
        )}
        <p className={styles.small}>
          Confira o calendário da escola. Feriados de Lagarto e datas próprias podem ser incluídos
          manualmente em “Dia ou intervalo”.
        </p>
      </form>
    </TaskDialog>
  );
}
