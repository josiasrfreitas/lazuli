"use client";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Video,
} from "lucide-react";
import { Button, EmptyState } from "@lazuli/ui";
import type { StageDetail, TeachingHour, TeachingProgram, ProgramUnit } from "./types";
import { HourDialog, hourLabel } from "./hour-dialog";
import { activityLabels } from "./activity-form";
import type { ProgramDialogState } from "./program-dialog";
import { ActionsMenu } from "./catalog-list";
import styles from "./workspace.module.css";

type Props = {
  stage: StageDetail;
  program: TeachingProgram;
  programSelector: ReactNode;
  open: (s: ProgramDialogState) => void;
};
export function ProgramMap({ stage, program, programSelector, open }: Props): React.JSX.Element {
  const [exams, setExams] = useState(false);
  const unit = program.units[0];
  const [selection, setSelection] = useState<{
    unitId: string;
    hourId: string;
    origin: HTMLButtonElement;
  } | null>(null);
  const selectedUnit = selection && program.units.find((entry) => entry.id === selection.unitId);
  const selectedHour = selectedUnit?.teachingHours.find((hour) => hour.id === selection?.hourId);
  const visibleUnits = program.units.filter((entry) => !exams || entry.teachingHours.some(hasExam));
  return (
    <div className={styles.curriculum}>
      <ProgramMapToolbar {...{ program, programSelector, open, unit, exams, setExams }} />
      {!unit && !exams && (
        <EmptyState
          title="Nenhuma unidade"
          action={
            <Button onClick={() => open({ action: "unit", programId: program.id })}>
              Adicionar unidade
            </Button>
          }
        />
      )}
      {visibleUnits.some((entry) => entry.teachingHours.length > 0) && (
        <p className={styles.meta}>
          Abra uma hora-aula para dividir seus 60 minutos entre atividades.
        </p>
      )}
      {visibleUnits.map((entry) => (
        <section key={entry.id} className={styles.unit} aria-label={entry.title}>
          <header className={styles.unitTitle}>
            <h2>
              {entry.title} · {entry.teachingHours.length} h
            </h2>
            <UnitActions programId={program.id} unit={entry} open={open} />
          </header>
          <div className={styles.hours}>
            {(exams ? entry.teachingHours.filter(hasExam) : entry.teachingHours).map((hour) => (
              <HourToggle
                key={hour.id}
                hour={hour}
                onOpen={(origin) => setSelection({ unitId: entry.id, hourId: hour.id, origin })}
              />
            ))}
          </div>
          {entry.teachingHours.length === 0 && (
            <EmptyState title="Nenhuma hora-aula nesta unidade" />
          )}
        </section>
      ))}
      {selectedHour && (
        <HourDialog
          stage={stage}
          program={program}
          unitTitle={selectedUnit!.title}
          hour={selectedHour}
          origin={selection!.origin}
          onClose={() => setSelection(null)}
        />
      )}
      {exams && visibleUnits.length === 0 && (
        <EmptyState
          title="Nenhuma prova nesta programação"
          description="Desative o filtro Provas para consultar toda a programação."
        />
      )}
    </div>
  );
}
type UnitActionProps = Pick<Props, "open"> & { unit: ProgramUnit; programId: string };
function UnitActions({ programId, unit, open }: UnitActionProps): React.JSX.Element {
  return (
    <div className={styles.unitActions}>
      <ActionsMenu
        name={unit.title}
        actions={[
          {
            label: "Adicionar unidade",
            icon: Plus,
            onClick: () => open({ action: "unit", programId }),
          },
          {
            label: "Editar unidade",
            icon: Pencil,
            onClick: () => open({ action: "renameUnit", programId, unit }),
          },
        ]}
      />
    </div>
  );
}

const hasExam = (hour: TeachingHour): boolean =>
  hour.activities.some((activity) => activity.kind === "ASSESSMENT");

const activityIcons = {
  LESSON: BookOpen,
  INTRODUCTION: BookOpen,
  REVIEW: RotateCcw,
  ASSESSMENT: ClipboardCheck,
  VIDEO: Video,
  ACTIVITY: Layers,
};
function HourToggle({
  hour,
  onOpen,
}: {
  hour: TeachingHour;
  onOpen: (origin: HTMLButtonElement) => void;
}): React.JSX.Element {
  const kind = hasExam(hour) ? "ASSESSMENT" : hour.activities[0]?.kind;
  const Icon = kind ? activityIcons[kind] : BookOpen;
  const preview = hour.activities
    .map((activity) =>
      activity.descriptionPending && activity.sourceCode
        ? activity.sourceCode + " · " + activity.bookTitle
        : activity.bookTitle,
    )
    .join(" · ");
  return (
    <button
      type="button"
      className={styles.hourToggle}
      data-kind={kind}
      aria-haspopup="dialog"
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <span className={styles.hourMeta}>
        <span className={styles.hourNumber}>
          {kind && (
            <>
              <Icon size={14} aria-hidden="true" />
              <span className="sr-only">{activityLabels[kind]} · </span>
            </>
          )}
          {hourLabel(hour)}
          {hour.activities.length > 1 && <span> · {hour.activities.length} atividades</span>}
        </span>
        <ChevronRight size={14} aria-hidden="true" />
      </span>
      <span className={styles.preview}>{preview || "Nenhuma atividade"}</span>
    </button>
  );
}

function ProgramMapToolbar({
  program,
  programSelector,
  open,
  unit,
  exams,
  setExams,
}: Omit<Props, "stage"> & {
  unit: ProgramUnit | undefined;
  exams: boolean;
  setExams: (value: boolean) => void;
}): React.JSX.Element {
  return (
    <div className={styles.mapToolbar}>
      <div className={styles.programControls}>
        {programSelector}
        <Button
          type="button"
          size="sm"
          aria-pressed={exams}
          variant={exams ? "secondary" : "ghost"}
          onClick={() => setExams(!exams)}
        >
          <ClipboardCheck /> Provas ({program.assessmentCount})
        </Button>
      </div>
      {unit && (
        <Button
          size="sm"
          className="ms-auto"
          onClick={() => open({ action: "hour", programId: program.id, unit })}
        >
          <Plus /> Nova hora-aula (+60 min)
        </Button>
      )}
    </div>
  );
}
