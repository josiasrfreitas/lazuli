"use client";
import { Fragment, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, ClipboardCheck, Pencil, Plus } from "lucide-react";
import { Button, EmptyState } from "@lazuli/ui";
import type {
  StageDetail,
  TeachingHour,
  TeachingProgram,
  ProgramUnit,
  ProgramActivity,
} from "./types";
import { ActivityForm, activityLabels } from "./activity-form";
import type { ProgramDialogState } from "./program-dialog";
import { ActionsMenu } from "./catalog-list";
import styles from "./workspace.module.css";

type Props = {
  stage: StageDetail;
  program: TeachingProgram;
  exams: boolean;
  open: (s: ProgramDialogState) => void;
};
export function ProgramMap({ stage, program, exams, open }: Props): React.JSX.Element {
  const [unitId, setUnitId] = useState(program.units[0]?.id);
  const unit = program.units.find((entry) => entry.id === unitId) ?? program.units[0];
  if (!unit)
    return (
      <EmptyState
        title="Nenhuma unidade"
        action={
          <Button onClick={() => open({ action: "unit", programId: program.id })}>
            Adicionar unidade
          </Button>
        }
      />
    );
  const hours = unit.teachingHours.filter(
    (hour) => !exams || hour.activities.some((activity) => activity.kind === "ASSESSMENT"),
  );
  return (
    <div className={styles.curriculum}>
      <UnitNavigation program={program} unit={unit} open={open} setUnitId={setUnitId} />
      <section className={styles.unit} aria-label={unit.title} key={unit.id}>
        <header className={styles.unitTitle}>
          <div>
            <h2>{unit.title}</h2>
            <p>{unit.teachingHours.length} horas-aula</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => open({ action: "hour", programId: program.id, unit })}
            >
              <Plus />
              Hora-aula
            </Button>
            <ActionsMenu
              name={unit.title}
              actions={[
                {
                  label: "Editar unidade",
                  onClick: () => open({ action: "renameUnit", programId: program.id, unit }),
                },
              ]}
            />
          </div>
        </header>
        <div className={styles.hours}>
          {hours.length > 0 ? (
            hours.map((hour) => (
              <HourRow key={hour.id} hour={hour} stage={stage} programId={program.id} />
            ))
          ) : (
            <EmptyState title="Nenhuma prova nesta unidade" />
          )}
        </div>
      </section>
    </div>
  );
}
function HourRow({
  hour,
  stage,
  programId,
}: {
  hour: TeachingHour;
  stage: StageDetail;
  programId: string;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [edit, setEdit] = useState<{ position: number; editing: boolean } | null>(null);
  function triggerId(position: number, editing: boolean): string {
    return hour.id + "-" + position + "-" + String(editing);
  }
  function close(): void {
    if (edit) {
      const id = triggerId(edit.position, edit.editing);
      setEdit(null);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("#" + CSS.escape(id))?.focus(),
      );
    }
  }
  const editor = { stage, programId, hour, edit, close, triggerId, setEdit };
  return (
    <article className={styles.hour} data-expanded={expanded || undefined}>
      <HourToggle
        hour={hour}
        expanded={expanded}
        toggle={() => {
          setExpanded(!expanded);
          setEdit(null);
        }}
      />
      {expanded && (
        <div className={styles.hourBody}>
          {hour.activities.map((activity, index) => (
            <Fragment key={activity.id}>
              <InsertActivity position={index} editor={editor} />
              {edit?.position === index && edit.editing ? (
                <ActivityForm
                  key={activity.id}
                  stage={stage}
                  programId={programId}
                  hour={hour}
                  position={index}
                  editing
                  close={close}
                />
              ) : (
                <ActivityRow
                  activity={activity}
                  trigger={triggerId(index, true)}
                  disabled={!!edit}
                  onEdit={() => setEdit({ position: index, editing: true })}
                />
              )}
            </Fragment>
          ))}
          <InsertActivity position={hour.activities.length} editor={editor} />
        </div>
      )}
    </article>
  );
}

function UnitNavigation({
  program,
  unit,
  open,
  setUnitId,
}: Pick<Props, "program" | "open"> & {
  unit: ProgramUnit;
  setUnitId: (id: string) => void;
}): React.JSX.Element {
  return (
    <nav className={styles.index} aria-label="Unidades da programação">
      <div className={styles.indexHead}>
        <h2>Unidades</h2>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Adicionar unidade"
          aria-label="Adicionar unidade"
          onClick={() => open({ action: "unit", programId: program.id })}
        >
          <Plus />
        </Button>
      </div>
      {program.units.map((entry) => (
        <button
          type="button"
          key={entry.id}
          aria-current={entry.id === unit.id ? "true" : undefined}
          onClick={() => setUnitId(entry.id)}
        >
          <span>{entry.title}</span>
          <span className={styles.ordinal}>{entry.teachingHours.length} h</span>
        </button>
      ))}
    </nav>
  );
}
function HourToggle({
  hour,
  expanded,
  toggle,
}: {
  hour: TeachingHour;
  expanded: boolean;
  toggle: () => void;
}): React.JSX.Element {
  const exam = hour.activities.some((activity) => activity.kind === "ASSESSMENT");
  const preview = hour.activities
    .map((activity) =>
      activity.descriptionPending && activity.sourceCode
        ? activity.sourceCode + " · " + activity.bookTitle
        : activity.bookTitle,
    )
    .join(" · ");
  const hourName = "Hora-aula " + String(hour.sequence).padStart(2, "0");
  return (
    <button
      type="button"
      className={styles.hourToggle}
      aria-expanded={expanded}
      aria-label={hourName + " · " + preview}
      onClick={toggle}
    >
      <span className={styles.hourNumber}>{hourName}</span>
      <span className={styles.preview}>
        {exam ? <ClipboardCheck size={16} /> : <BookOpen size={16} />}
        <span>{preview}</span>
      </span>
      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
    </button>
  );
}
function pagesLabel({ pageStart, pageEnd }: ProgramActivity): string | null {
  if (pageStart === null) return null;
  if (pageEnd === null || pageEnd === pageStart) return "Pág. " + pageStart;
  return "Págs. " + pageStart + "–" + pageEnd + " · " + (pageEnd - pageStart + 1) + " páginas";
}
function ActivityRow({
  activity,
  trigger,
  disabled,
  onEdit,
}: {
  activity: ProgramActivity;
  trigger: string;
  disabled: boolean;
  onEdit: () => void;
}): React.JSX.Element {
  return (
    <div className={styles.activity}>
      <div>
        <strong>{activity.bookTitle}</strong>
        <p>
          {[
            activityLabels[activity.kind],
            ...activity.lessons.map(
              (lesson) => lesson.title + (lesson.part ? " · " + lesson.part : ""),
            ),
            pagesLabel(activity),
            activity.durationMinutes + " min",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {activity.descriptionPending && <small>Descrição pendente · {activity.sourceCode}</small>}
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        id={trigger}
        disabled={disabled}
        aria-label={"Editar " + activity.bookTitle}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
    </div>
  );
}

type HourEditor = {
  stage: StageDetail;
  programId: string;
  hour: TeachingHour;
  edit: { position: number; editing: boolean } | null;
  close: () => void;
  triggerId: (position: number, editing: boolean) => string;
  setEdit: (item: { position: number; editing: boolean }) => void;
};
function InsertActivity({
  position,
  editor,
}: {
  position: number;
  editor: HourEditor;
}): React.JSX.Element {
  const { stage, programId, hour, edit, close, triggerId, setEdit } = editor;
  if (edit?.position === position && !edit.editing)
    return (
      <ActivityForm
        key={"new" + position}
        stage={stage}
        programId={programId}
        hour={hour}
        position={position}
        editing={false}
        close={close}
      />
    );
  return (
    <Button
      size="sm"
      type="button"
      id={triggerId(position, false)}
      variant="text"
      disabled={!!edit}
      onClick={() => setEdit({ position: position, editing: false })}
    >
      <Plus />
      Inserir aqui
    </Button>
  );
}
