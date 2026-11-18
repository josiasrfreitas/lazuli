"use client";
import { useEffect, useState, type Dispatch, type SetStateAction, type ReactElement } from "react";
import { CalendarPlus, CalendarDays, ArrowRight } from "lucide-react";
import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import { Button, Checkbox, Field, Label } from "@lazuli/ui";
import { trpc, type TRPCClient } from "~/lib/trpc";
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
const reviewExtraDialog = {
  title: "Confira as aulas extras",
  size: "medium",
  firstField: "confirm-extra",
  pendingLabel: "Agendando…",
  submitLabel: "Agendar aulas",
} as const;
const entryExtraDialog = {
  title: "Adicionar aulas à turma",
  size: "wide",
  firstField: "from",
  pendingLabel: "Conferindo…",
  submitLabel: "Conferir programação",
} as const;

export function ExtraClassesForm({
  data,
  onClose,
  onBack,
  onSaved,
}: AdjustmentFormProps): ReactElement {
  const model = useExtraClasses(data, onSaved);
  const { fields, reviewing, preview, pending, loading, previewError, reset } = model;
  return (
    <TaskDialog
      {...(reviewing ? reviewExtraDialog : entryExtraDialog)}
      description={data.scope.class.name}
      formId="extra-classes"
      pending={pending}
      onClose={onClose}
      onBack={reviewing ? reset : onBack}
      submitIcon={<CalendarPlus />}
      submitDisabled={
        reviewing
          ? Boolean(preview?.outside) && !fields.input.allowOutsidePeriod
          : !preview || loading
      }
      footerSummary={
        !reviewing && (
          <CompactExtraCapacity preview={preview} loading={loading} error={previewError} />
        )
      }
    >
      <ExtraFormBody data={data} model={model} />
    </TaskDialog>
  );
}

function ExtraFormBody({ data, model }: { data: Planning; model: ExtraModel }): ReactElement {
  const {
    fields,
    reviewing,
    preview,
    loading,
    previewError,
    ready,
    errorMessage,
    submit,
    existing,
    occupiedDays,
  } = model;
  return (
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
        {reviewing ? (
          preview && <ExtraReview preview={preview} fields={fields} />
        ) : (
          <ExtraScheduleFields fields={fields} existing={existing} occupiedDays={occupiedDays} />
        )}
      </form>
      {!reviewing && (
        <ExtraCapacity
          data={data}
          preview={preview}
          loading={loading}
          error={previewError}
          ready={ready}
        />
      )}
    </div>
  );
}

const EXTRA_PREVIEW_DELAY_MS = 350;
const MIN_REASON_LENGTH = 3;
const weekdaysByIndex = ["1", "2", "3", "4", "5", "6", "7"] as const;
type Weekday = (typeof weekdaysByIndex)[number];
type ExtraInput = RouterInputs["planning"]["previewExtra"];
type Teachers = {
  data: RouterOutputs["teachers"]["options"] | undefined;
  error: { message: string } | null;
  refetch: () => Promise<object>;
};
type ExtraFieldsModel = {
  input: ExtraInput;
  from: string;
  through: string;
  setFrom: (value: string) => void;
  setThrough: (value: string) => void;
  setTeacherId: (value: string) => void;
  setWeekdays: Dispatch<SetStateAction<Weekday[]>>;
  setStartTime: (value: string) => void;
  setEndTime: (value: string) => void;
  setReason: (value: string) => void;
  setAllowOutsidePeriod: (value: boolean) => void;
  teachers: Teachers;
};
type ExtraModel = {
  fields: ExtraFieldsModel;
  existing: Planning["availableSessions"];
  occupiedDays: Set<number>;
  ready: boolean;
  reviewing: boolean;
  preview: ExtraPreview | null;
  loading: boolean;
  previewError: string | null;
  pending: boolean;
  errorMessage: string | undefined;
  reset: () => void;
  submit: () => void;
};

function initialExtraDate(data: Planning): string {
  return dateLabel(
    [data.scope.today, data.plan?.plannedStartOn ?? data.scope.classStartOn].toSorted().at(-1),
  );
}

function useExtraFields(data: Planning): ExtraFieldsModel {
  const [id] = useState(() => crypto.randomUUID());
  const [from, setFrom] = useState(initialExtraDate(data));
  const [through, setThrough] = useState(dateLabel(data.scope.semester.endOn));
  const [teacherId, setTeacherId] = useState(data.scope.class.teacherId ?? "");
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [reason, setReason] = useState("");
  const [allowOutsidePeriod, setAllowOutsidePeriod] = useState(false);
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
  return {
    input,
    from,
    through,
    setFrom,
    setThrough,
    setTeacherId,
    setWeekdays,
    setStartTime,
    setEndTime,
    setReason,
    setAllowOutsidePeriod,
    teachers,
  };
}

function useExtraClasses(data: Planning, onSaved: AdjustmentFormProps["onSaved"]): ExtraModel {
  const fields = useExtraFields(data);
  const { input, setAllowOutsidePeriod } = fields;
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const utils = trpc.useUtils();
  useEffect(() => {
    void utils.planning.detail.invalidate({ classId: data.scope.class.id });
  }, [data.scope.class.id, utils]);
  const save = trpc.planning.scheduleExtra.useMutation({
    onSuccess: () => onSaved("Aulas adicionadas. Projeção atualizada."),
  });
  const ready = extraInputsReady(input);
  const { current, loading } = useLivePreview(utils.client, { input, ready, reviewing });
  const preview = current?.data ?? null;
  const pending = save.isPending;
  const existing = scheduledDays(data, {
    from: input.from || data.scope.today,
    through: input.through || data.scope.semester.endOn,
  });
  const occupiedDays = new Set(
    existing.map((session) => new Date(`${session.date}T12:00:00Z`).getUTCDay()),
  );
  function reset(): void {
    setReviewing(false);
    save.reset();
    setAllowOutsidePeriod(false);
  }
  function submit(): void {
    if (pending) return;
    if (!validExtraDraft(input)) {
      setError("Informe as datas, o professor, os dias da semana e o motivo.");
      return;
    }
    setError(undefined);
    if (!preview) return;
    if (!reviewing) setReviewing(true);
    else if (preview.outside === 0 || input.allowOutsidePeriod)
      save.mutate({ ...input, fingerprint: preview.fingerprint });
  }
  return {
    fields,
    existing,
    occupiedDays,
    reviewing,
    preview,
    ready,
    loading,
    pending,
    previewError: current?.error ?? null,
    errorMessage: error ?? save.error?.message,
    reset,
    submit,
  };
}

function validExtraDraft(input: ExtraInput): boolean {
  return Boolean(
    input.from &&
    input.through &&
    input.teacherId &&
    input.weekdays.length > 0 &&
    input.reason.trim().length >= MIN_REASON_LENGTH,
  );
}

function extraInputsReady(input: ExtraInput): boolean {
  return Boolean(
    input.from &&
    input.through &&
    input.teacherId &&
    input.weekdays.length > 0 &&
    input.startTime &&
    input.endTime,
  );
}

type LivePreview = { key: string; data: ExtraPreview | null; error: string | null };
function useLivePreview(
  client: TRPCClient,
  {
    input,
    ready,
    reviewing,
  }: {
    input: ExtraInput;
    ready: boolean;
    reviewing: boolean;
  },
): { current: LivePreview | null; loading: boolean } {
  const liveKey = JSON.stringify({
    ...input,
    reason: "Prévia de aulas extras.",
    allowOutsidePeriod: false,
  });
  const [live, setLive] = useState<{
    key: string;
    data: ExtraPreview | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    if (!ready || reviewing) return;
    let active = true;
    const timer = setTimeout(() => {
      const request = JSON.parse(liveKey) as RouterInputs["planning"]["previewExtra"];
      void client.planning.previewExtra.mutate(request).then(
        (result) => {
          if (active) setLive({ key: liveKey, data: result, error: null });
        },
        (error_) => {
          if (active)
            setLive({
              key: liveKey,
              data: null,
              error:
                error_ instanceof Error ? error_.message : "Não foi possível conferir os horários.",
            });
        },
      );
    }, EXTRA_PREVIEW_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [liveKey, ready, reviewing, client]);
  const current = live?.key === liveKey ? live : null;
  return { current, loading: ready && current === null };
}

function ExtraScheduleFields({
  fields,
  existing,
  occupiedDays,
}: {
  fields: ExtraFieldsModel;
  existing: ExtraModel["existing"];
  occupiedDays: Set<number>;
}): ReactElement {
  const {
    from,
    through,
    setFrom,
    setThrough,
    setWeekdays,
    setStartTime,
    setEndTime,
    setTeacherId,
    setReason,
    teachers,
  } = fields;
  const { weekdays, startTime, endTime, teacherId, reason } = fields.input;
  return (
    <>
      <p className={styles.help}>
        Os alunos matriculados em cada encontro entram automaticamente na chamada da turma.
      </p>
      <div className={styles.dateRow}>
        <PlanDateField name="from" label="A partir de" value={from} onChange={setFrom} />
        <PlanDateField name="through" label="Até" value={through} onChange={setThrough} />
      </div>
      <RecurringDays weekdays={weekdays} setWeekdays={setWeekdays} occupiedDays={occupiedDays} />
      <ExistingSchedule sessions={existing} />
      <div className={styles.timeRow}>
        <TextControl
          name="startTime"
          label="Início"
          type="time"
          value={startTime}
          onChange={setStartTime}
        />
        <TextControl name="endTime" label="Fim" type="time" value={endTime} onChange={setEndTime} />
      </div>
      <ExtraTeacherField teacherId={teacherId} setTeacherId={setTeacherId} teachers={teachers} />
      <NarrativeField
        name="reason"
        label="Motivo"
        value={reason}
        onChange={setReason}
        rows={2}
        placeholder="Ex.: concluir a unidade e reservar tempo para revisão"
      />
    </>
  );
}

function RecurringDays({
  weekdays,
  setWeekdays,
  occupiedDays,
}: {
  weekdays: Weekday[];
  setWeekdays: ExtraFieldsModel["setWeekdays"];
  occupiedDays: Set<number>;
}): ReactElement {
  return (
    <fieldset className={styles.weekdays}>
      <legend>Repetir nos dias</legend>
      <div>
        {weekdaysByIndex.map((day, index) => {
          const label = days[index];
          return (
            <Button
              key={day}
              type="button"
              size="sm"
              variant={weekdays.includes(day) ? "secondary" : "ghost"}
              aria-pressed={weekdays.includes(day)}
              aria-label={occupiedDays.has(index) ? `${label} · já tem aula` : label}
              aria-describedby={occupiedDays.has(index) ? "existing-class-schedule" : undefined}
              onClick={() =>
                setWeekdays((value) =>
                  value.includes(day) ? value.filter((item) => item !== day) : [...value, day],
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
  );
}

function ExtraTeacherField({
  teacherId,
  setTeacherId,
  teachers,
}: {
  teacherId: string;
  setTeacherId: ExtraFieldsModel["setTeacherId"];
  teachers: Teachers;
}): ReactElement {
  return (
    <>
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
    </>
  );
}

function extraReviewMessage(preview: ExtraPreview): string {
  if (preview.uncertain) return "O saldo de conteúdo depende de confirmar os registros pendentes.";
  if (preview.margin < 0)
    return `Ainda faltarão ${hourLabel(-preview.margin)} para concluir o conteúdo.`;
  if (preview.margin === 0) return "O conteúdo passa a caber exatamente nas aulas disponíveis.";
  return `O conteúdo cabe com ${hourLabel(preview.margin)} de folga.`;
}

function ExtraReview({
  preview,
  fields,
}: {
  preview: ExtraPreview;
  fields: ExtraFieldsModel;
}): ReactElement {
  const {
    input: { startTime, endTime, teacherId, weekdays, allowOutsidePeriod },
    teachers,
    setAllowOutsidePeriod,
  } = fields;
  return (
    <>
      <div className={styles.preview} aria-live="polite">
        <h3>
          {encounterLabel(preview.dates.length)} · +{hourLabel(preview.addedMinutes)}
        </h3>
        <p>
          {dateLabel(preview.dates[0])} a {dateLabel(preview.dates.at(-1))} · {startTime}–{endTime}
        </p>
        <p>
          {teachers.data?.find((row) => row.id === teacherId)?.name} ·{" "}
          {weekdays.map((day) => days[Number(day) - 1]).join(" e ")}
        </p>
        <div className={styles.balance}>
          <span>{hourLabel(preview.availableMinutes)} disponíveis</span>
          <ArrowRight aria-hidden="true" />
          <strong>{hourLabel(preview.availableMinutes + preview.addedMinutes)} disponíveis</strong>
        </div>
        <p>{extraReviewMessage(preview)}</p>
      </div>
      <details className={styles.dates}>
        <summary>Ver datas dos encontros</summary>
        <p>{preview.dates.map(dateLabel).join(" · ")}</p>
      </details>
      {preview.skipped.length > 0 && (
        <p className={styles.help}>
          {preview.skipped.length === 1
            ? "1 encontro ignorado"
            : `${preview.skipped.length} encontros ignorados`}{" "}
          por fechamento:{" "}
          {preview.skipped.map((row) => `${dateLabel(row.date)} (${row.reason})`).join("; ")}.
        </p>
      )}
      {preview.outside > 0 && (
        <Field>
          <Label>
            <span className={styles.confirm}>
              <Checkbox
                id="confirm-extra"
                name="confirm-extra"
                checked={allowOutsidePeriod}
                onCheckedChange={(checked) => setAllowOutsidePeriod(Boolean(checked))}
              />
              Confirmo {encounterLabel(preview.outside)} fora do período letivo, incluindo férias.
            </span>
          </Label>
        </Field>
      )}
      <p className={styles.help}>
        A presença e o conteúdo serão registrados em cada aula. O calendário das outras turmas
        permanece independente.
      </p>
    </>
  );
}
