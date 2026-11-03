import { useState, type ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { Check, RefreshCw } from "lucide-react";
import type { OccurrenceFormModel } from "./occurrence-form-model";
import { dateLabel } from "./shared";
import styles from "./occurrence-form.module.css";

const LIST_PAGE_SIZE = 10;
const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;
type Lesson = NonNullable<OccurrenceFormModel["sessions"]["data"]>[number];

export function OccurrenceLessonList({ model }: { model: OccurrenceFormModel }): ReactElement {
  const rows = model.sessions.data ?? [];
  return (
    <div className={styles.lessonList}>
      <div className={styles.lessonListHeading}>
        <div>
          <strong>Aulas recentes</strong>
          <p>Selecione a aula em que a ocorrência aconteceu.</p>
        </div>
        {rows.length > 0 && (
          <span>
            {rows.length} {rows.length === 1 ? "aula" : "aulas"}
          </span>
        )}
      </div>
      <LessonListContent model={model} rows={rows} />
    </div>
  );
}

function LessonListContent({
  model,
  rows,
}: {
  model: OccurrenceFormModel;
  rows: Lesson[];
}): ReactElement {
  if (model.calendarBusy) return <p className={styles.lessonListState}>Carregando aulas…</p>;
  if (model.sessions.isError)
    return (
      <div className={styles.lessonListState} role="alert">
        <p>Não foi possível carregar as aulas.</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void model.sessions.refetch()}
        >
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    );
  if (rows.length === 0)
    return <p className={styles.lessonListState}>Nenhuma aula disponível para este aluno.</p>;
  return <LessonChoices model={model} rows={rows} />;
}

function LessonChoices({
  model,
  rows,
}: {
  model: OccurrenceFormModel;
  rows: Lesson[];
}): ReactElement {
  const [visible, setVisible] = useState(LIST_PAGE_SIZE);
  return (
    <div className={styles.lessonListScroll}>
      <div className={styles.lessonChoices} role="group" aria-label="Aulas recentes do aluno">
        {rows.slice(0, visible).map((row) => (
          <LessonChoice key={row.id} model={model} row={row} />
        ))}
      </div>
      {visible < rows.length && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setVisible((count) => count + LIST_PAGE_SIZE)}
        >
          Mostrar mais aulas
        </Button>
      )}
    </div>
  );
}

function LessonChoice({ model, row }: { model: OccurrenceFormModel; row: Lesson }): ReactElement {
  const selected = model.values.classSessionId === row.id;
  const start = row.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX);
  const end = row.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX);
  return (
    <button
      type="button"
      className={styles.lessonChoice}
      aria-pressed={selected}
      disabled={model.save.isPending}
      onClick={() => model.change("classSessionId", row.id)}
    >
      <span className={styles.lessonChoiceDate}>
        {dateLabel(row.date)}{" "}
        <span>
          {start}–{end}
        </span>
      </span>
      <span className={styles.lessonChoiceMain}>
        <strong>{row.className}</strong>
        {selected && <Check aria-hidden="true" />}
      </span>
      <span className={styles.lessonChoiceMeta}>
        {row.scheduleType === "PERSONALIZED" ? "PPT" : (row.stageName ?? "Regular")}
        {" · "}
        {row.format === "ONLINE" ? "Online" : "Presencial"}
      </span>
    </button>
  );
}
