import { BookOpen, ClipboardCheck, Layers, RotateCcw, Video } from "lucide-react";
import { EmptyState } from "@lazuli/ui";
import type { ProgramActivity, TeachingHour, TeachingProgram } from "./types";
import styles from "./program-map.module.css";

const icons = {
  LESSON: BookOpen,
  INTRODUCTION: BookOpen,
  REVIEW: RotateCcw,
  ASSESSMENT: ClipboardCheck,
  VIDEO: Video,
  ACTIVITY: Layers,
};
const labels = {
  LESSON: "Lição",
  INTRODUCTION: "Introdução",
  REVIEW: "Revisão",
  ASSESSMENT: "Prova",
  VIDEO: "Vídeo",
  ACTIVITY: "Atividade",
};
const number = (value: number) => String(value).padStart(2, "0");

/** Visual grouping only; source identities, units and assessment counts come from the API. */
function blocksFor(hours: TeachingHour[]) {
  const blocks: {
    first: number;
    last: number;
    activities: ProgramActivity[];
    signature: string;
  }[] = [];
  for (const hour of hours) {
    const signature = JSON.stringify(
      hour.activities.map((activity) => ({
        kind: activity.kind,
        title: activity.title,
        sourceCode: activity.sourceCode,
        duration: activity.durationMinutes,
        assessmentId: activity.assessment?.id,
        lessons: activity.lessons,
        pending: activity.descriptionPending,
      })),
    );
    const previous = blocks.at(-1);
    if (previous?.signature === signature && previous.last === hour.sequence - 1)
      previous.last = hour.sequence;
    else
      blocks.push({
        first: hour.sequence,
        last: hour.sequence,
        activities: hour.activities,
        signature,
      });
  }
  return blocks;
}

export function ProgramMap({
  program,
  onlyAssessments,
}: {
  program: TeachingProgram;
  onlyAssessments: boolean;
}) {
  const units = program.units
    .map((unit) => ({
      ...unit,
      blocks: blocksFor(
        unit.teachingHours.filter(
          (hour) =>
            !onlyAssessments || hour.activities.some((activity) => activity.kind === "ASSESSMENT"),
        ),
      ),
    }))
    .filter((unit) => unit.blocks.length);
  if (!units.length)
    return (
      <EmptyState
        title="Nenhuma prova nesta programação"
        description="Selecione Tudo para consultar o conteúdo disponível."
      />
    );
  return (
    <div className={styles.map}>
      {units.map((unit) => (
        <section className={styles.unit} key={unit.id} aria-label={unit.title}>
          <header className={styles.unitHeader}>
            <h3>{unit.title}</h3>
            <span>{unit.teachingHours.length} horas-aula</span>
          </header>
          <ol className={styles.blocks}>
            {unit.blocks.map((block) => (
              <li
                key={block.first}
                className={styles.block}
                data-kind={
                  block.activities.some((activity) => activity.kind === "ASSESSMENT")
                    ? "ASSESSMENT"
                    : block.activities[0]?.kind
                }
              >
                <div className={styles.blockMeta}>
                  <span>
                    {block.first === block.last
                      ? `Hora-aula ${number(block.first)}`
                      : `Horas-aula ${number(block.first)}–${number(block.last)}`}
                  </span>
                  <span>{block.last - block.first + 1}h</span>
                </div>
                {block.activities.map((activity) => {
                  const Icon = icons[activity.kind];
                  return (
                    <div key={activity.id} className={styles.activity}>
                      <h4>{activity.title}</h4>
                      <p>
                        <Icon size={14} aria-hidden="true" />
                        {labels[activity.kind]}
                      </p>
                      {activity.descriptionPending && (
                        <small>Descrição pendente · código {activity.sourceCode}</small>
                      )}
                    </div>
                  );
                })}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
