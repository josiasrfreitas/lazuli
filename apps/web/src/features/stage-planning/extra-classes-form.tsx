"use client";
import { useEffect, useState, type ReactElement } from "react";
import { CalendarPlus, CalendarDays, ArrowRight } from "lucide-react";
import type { RouterInputs } from "@lazuli/api";
import { Button, Checkbox, Field, Label } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { PlanDateField } from "./form-fields";
import { dateLabel, type Planning } from "./shared";
import {
  ExtraCapacity,
  CompactExtraCapacity,
  hourLabel,
  encounterLabel,
  type ExtraPreview,
} from "./extra-capacity";
import styles from "./adjustments.module.css";
import { ExistingSchedule, scheduledDays, weekLabels } from "./existing-schedule";

const days = weekLabels;
export type AdjustmentFormProps = {
  data: Planning;
  onClose: () => void;
  onBack: () => void;
  onSaved: (message: string) => Promise<void>;
};
export function ExtraClassesForm({
  data,
  onClose,
  onBack,
  onSaved,
}: AdjustmentFormProps): ReactElement {
  const [id] = useState(() => crypto.randomUUID());
  const [from, setFrom] = useState(
    dateLabel(
      [data.scope.today, data.plan?.plannedStartOn ?? data.scope.classStartOn].sort().at(-1)!,
    ),
  );
  const [through, setThrough] = useState(dateLabel(data.scope.semester.endOn));
  const [teacherId, setTeacherId] = useState(data.scope.class.teacherId ?? "");
  const [weekdays, setWeekdays] = useState<("1" | "2" | "3" | "4" | "5" | "6" | "7")[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [reason, setReason] = useState("");
  const [allowOutsidePeriod, setAllowOutsidePeriod] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const utils = trpc.useUtils();
  useEffect(() => {
    void utils.planning.detail.invalidate({ classId: data.scope.class.id });
  }, [data.scope.class.id, utils]);
  const [reviewing, setReviewing] = useState(false);
  const [live, setLive] = useState<{
    key: string;
    data: ExtraPreview | null;
    error: string | null;
  } | null>(null);
  const save = trpc.planning.scheduleExtra.useMutation({
    onSuccess: () => onSaved("Aulas adicionadas. Projeção atualizada."),
  });
  const teachers = trpc.teachers.options.useQuery({ date: parseDateBR(from) ?? data.scope.today });
  const input = {
    id,
    classId: data.scope.class.id,
    teacherId,
    from: parseDateBR(from) ?? "",
    through: parseDateBR(through) ?? "",
    weekdays,
    startTime,
    endTime,
    reason,
    allowOutsidePeriod,
  };
  const liveInput = { ...input, reason: "Prévia de aulas extras.", allowOutsidePeriod: false };
  const liveKey = JSON.stringify(liveInput);
  const existing = scheduledDays(
    data,
    input.from || data.scope.today,
    input.through || data.scope.semester.endOn,
  );
  const occupiedDays = new Set(
    existing.map((session) => new Date(`${session.date}T12:00:00Z`).getUTCDay()),
  );
  const ready = Boolean(
    input.from && input.through && teacherId && weekdays.length && startTime && endTime,
  );
  const current = live?.key === liveKey ? live : null;
  const loading = ready && !current;
  const preview = { data: current?.data ?? null };
  const pending = save.isPending;
  const errorMessage = error ?? save.error?.message;
  useEffect(() => {
    if (!ready || reviewing) return;
    let active = true;
    const timer = setTimeout(() => {
      const request = JSON.parse(liveKey) as RouterInputs["planning"]["previewExtra"];
      void utils.client.planning.previewExtra.mutate(request).then(
        (result) => {
          if (active) setLive({ key: liveKey, data: result, error: null });
        },
        (cause: unknown) => {
          if (active)
            setLive({
              key: liveKey,
              data: null,
              error:
                cause instanceof Error ? cause.message : "Não foi possível conferir os horários.",
            });
        },
      );
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [liveKey, ready, reviewing, utils.client]);
  const reset = () => {
    setReviewing(false);
    save.reset();
    setAllowOutsidePeriod(false);
  };
  const submit = () => {
    if (pending) return;
    if (
      !input.from ||
      !input.through ||
      !teacherId ||
      !weekdays.length ||
      reason.trim().length < 3
    ) {
      setError("Informe as datas, o professor, os dias da semana e o motivo.");
      return;
    }
    setError(undefined);
    if (!reviewing) {
      if (preview.data) setReviewing(true);
    } else if (!preview.data!.outside || allowOutsidePeriod)
      save.mutate({ ...input, fingerprint: preview.data!.fingerprint });
  };
  return (
    <TaskDialog
      title={reviewing ? "Confira as aulas extras" : "Adicionar aulas à turma"}
      description={data.scope.class.name}
      size={reviewing ? "medium" : "wide"}
      formId="extra-classes"
      firstField={reviewing ? "confirm-extra" : "from"}
      pending={pending}
      pendingLabel={reviewing ? "Agendando…" : "Conferindo…"}
      onClose={onClose}
      onBack={reviewing ? reset : onBack}
      submitLabel={reviewing ? "Agendar aulas" : "Conferir programação"}
      submitIcon={<CalendarPlus />}
      submitDisabled={
        !reviewing
          ? !preview.data || loading
          : Boolean(preview.data?.outside) && !allowOutsidePeriod
      }
      footerSummary={
        !reviewing && (
          <CompactExtraCapacity
            preview={preview.data}
            loading={loading}
            error={current?.error ?? null}
          />
        )
      }
    >
      <div className={reviewing ? undefined : styles.scheduleLayout}>
        <form
          id="extra-classes"
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {errorMessage && (
            <p role="alert" className={styles.error}>
              {errorMessage}
            </p>
          )}
          {!reviewing ? (
            <>
              <p className={styles.help}>
                Os alunos matriculados em cada encontro entram automaticamente na chamada da turma.
              </p>
              <div className={styles.dateRow}>
                <PlanDateField name="from" label="A partir de" value={from} onChange={setFrom} />
                <PlanDateField name="through" label="Até" value={through} onChange={setThrough} />
              </div>
              <fieldset className={styles.weekdays}>
                <legend>Repetir nos dias</legend>
                <div>
                  {days.map((label, index) => {
                    const day = String(index + 1) as (typeof weekdays)[number];
                    return (
                      <Button
                        key={day}
                        type="button"
                        size="sm"
                        variant={weekdays.includes(day) ? "secondary" : "ghost"}
                        aria-pressed={weekdays.includes(day)}
                        aria-label={occupiedDays.has(index) ? `${label} · já tem aula` : label}
                        aria-describedby={
                          occupiedDays.has(index) ? "existing-class-schedule" : undefined
                        }
                        onClick={() =>
                          setWeekdays((value) =>
                            value.includes(day)
                              ? value.filter((item) => item !== day)
                              : [...value, day],
                          )
                        }
                      >
                        {label}
                        {occupiedDays.has(index) && <CalendarDays aria-hidden="true" />}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>
              <ExistingSchedule sessions={existing} />
              <div className={styles.timeRow}>
                <TextControl
                  name="startTime"
                  label="Início"
                  type="time"
                  value={startTime}
                  onChange={setStartTime}
                />
                <TextControl
                  name="endTime"
                  label="Fim"
                  type="time"
                  value={endTime}
                  onChange={setEndTime}
                />
              </div>
              <SelectControl
                name="teacherId"
                label="Professor"
                value={teacherId}
                onChange={setTeacherId}
                choices={(teachers.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
              />
              {teachers.error && (
                <p role="alert">
                  Não foi possível carregar os professores.{" "}
                  <Button size="sm" variant="ghost" onClick={() => void teachers.refetch()}>
                    Tentar novamente
                  </Button>
                </p>
              )}
              <NarrativeField
                name="reason"
                label="Motivo"
                value={reason}
                onChange={setReason}
                rows={2}
                placeholder="Ex.: concluir a unidade e reservar tempo para revisão"
              />
            </>
          ) : (
            preview.data && (
              <>
                <div className={styles.preview} aria-live="polite">
                  <h3>
                    {encounterLabel(preview.data.dates.length)} · +
                    {hourLabel(preview.data.addedMinutes)}
                  </h3>
                  <p>
                    {dateLabel(preview.data.dates[0]!)} a {dateLabel(preview.data.dates.at(-1)!)} ·{" "}
                    {startTime}–{endTime}
                  </p>
                  <p>
                    {teachers.data?.find((row) => row.id === teacherId)?.name} ·{" "}
                    {weekdays.map((day) => days[Number(day) - 1]).join(" e ")}
                  </p>
                  <div className={styles.balance}>
                    <span>{hourLabel(preview.data.availableMinutes)} disponíveis</span>
                    <ArrowRight aria-hidden="true" />
                    <strong>
                      {hourLabel(preview.data.availableMinutes + preview.data.addedMinutes)}{" "}
                      disponíveis
                    </strong>
                  </div>
                  <p>
                    {preview.data.uncertain
                      ? "O saldo de conteúdo depende de confirmar os registros pendentes."
                      : preview.data.margin < 0
                        ? `Ainda faltarão ${hourLabel(-preview.data.margin)} para concluir o conteúdo.`
                        : preview.data.margin === 0
                          ? "O conteúdo passa a caber exatamente nas aulas disponíveis."
                          : `O conteúdo cabe com ${hourLabel(preview.data.margin)} de folga.`}
                  </p>
                </div>
                <details className={styles.dates}>
                  <summary>Ver datas dos encontros</summary>
                  <p>{preview.data.dates.map(dateLabel).join(" · ")}</p>
                </details>
                {preview.data.skipped.length > 0 && (
                  <p className={styles.help}>
                    {preview.data.skipped.length === 1
                      ? "1 encontro ignorado"
                      : `${preview.data.skipped.length} encontros ignorados`}{" "}
                    por fechamento:{" "}
                    {preview.data.skipped
                      .map((row) => `${dateLabel(row.date)} (${row.reason})`)
                      .join("; ")}
                    .
                  </p>
                )}
                {preview.data.outside > 0 && (
                  <Field>
                    <Label className={styles.confirm}>
                      <Checkbox
                        id="confirm-extra"
                        name="confirm-extra"
                        checked={allowOutsidePeriod}
                        onCheckedChange={(checked) => setAllowOutsidePeriod(Boolean(checked))}
                      />
                      Confirmo {encounterLabel(preview.data.outside)} fora do período letivo,
                      incluindo férias.
                    </Label>
                  </Field>
                )}
                <p className={styles.help}>
                  A presença e o conteúdo serão registrados em cada aula. O calendário das outras
                  turmas permanece independente.
                </p>
              </>
            )
          )}
        </form>
        {!reviewing && (
          <ExtraCapacity
            data={data}
            preview={preview.data}
            loading={loading}
            error={current?.error ?? null}
            ready={ready}
          />
        )}
      </div>
    </TaskDialog>
  );
}
