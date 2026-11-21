"use client";
import type { ReactElement } from "react";
import { ExperienceLink as Link } from "~/lib/teacher-view-navigation";
import { Check, Clock3, ArrowRight, CalendarDays } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@lazuli/ui";
import { dateLabel, type Planning, type PlannedItem } from "./shared";
import { type ContentGroup } from "./outlook-model";
import styles from "./program-explorer.module.css";

export function ProgramExplorer({
  data,
  groups,
  onClose,
  onEdit,
}: {
  data: Planning;
  groups: ContentGroup[];
  onClose: () => void;
  onEdit?: ((item: PlannedItem) => void) | undefined;
}): ReactElement {
  const steps = groups.flatMap((group) => group.steps);
  const completed = steps.filter((step) => step.state === "completed").length;
  const units = [...new Set(groups.map((group) => group.unit))];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Explore a programação</DialogTitle>
            <DialogDescription>
              {completed} de {steps.length} atividades concluídas · {data.scope.stage.name}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.overview}>
              <progress
                max={steps.length || 1}
                value={completed}
                aria-label="Atividades concluídas"
              />
              <p>
                As próximas datas acompanham as aulas disponíveis e o conteúdo que ainda falta
                concluir.
              </p>
            </div>
            <div className={styles.units}>
              {units.map((unit) => (
                <ProgramUnit
                  key={unit}
                  unit={unit}
                  groups={groups.filter((group) => group.unit === unit)}
                  projection={data.projection}
                  actions={{ onClose, onEdit }}
                />
              ))}
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

type ExplorerActions = {
  onClose: () => void;
  onEdit: ((item: PlannedItem) => void) | undefined;
};
type ProgramProjection = Planning["projection"];
type ProgramStep = ContentGroup["steps"][number];
type GroupState = "done" | "partial" | "next";

function ProgramUnit({
  unit,
  groups,
  projection,
  actions,
}: {
  unit: string;
  groups: ContentGroup[];
  projection: ProgramProjection;
  actions: ExplorerActions;
}): ReactElement {
  const completed = groups
    .flatMap((group) => group.steps)
    .filter((step) => step.state === "completed").length;
  return (
    <section className={styles.unit} aria-label={unit}>
      <h3>
        {unit}
        <span>{completed} concluídas</span>
      </h3>
      {groups.map((group) => (
        <ProgramGroup key={group.id} group={group} projection={projection} actions={actions} />
      ))}
    </section>
  );
}

function ProgramGroup({
  group,
  projection,
  actions,
}: {
  group: ContentGroup;
  projection: ProgramProjection;
  actions: ExplorerActions;
}): ReactElement {
  const state = groupState(group);
  const dates = group.steps
    .filter((step) => step.state !== "completed")
    .map((step) => projection.find((row) => row.itemId === step.item.id)?.date ?? null);
  return (
    <details className={styles.group} data-state={state}>
      <summary>
        <span className={styles.marker}>{groupMarker(state)}</span>
        <span className={styles.name}>
          <strong>{group.title}</strong>
          <span>{groupStatus(state, group.steps.length)}</span>
        </span>
        <span className={styles.date}>{groupDateLabel(state, dates)}</span>
      </summary>
      <div className={styles.activities}>
        {group.steps.map((step) => (
          <ProgramActivity
            key={step.item.id}
            step={step}
            date={projection.find((row) => row.itemId === step.item.id)?.date ?? null}
            actions={actions}
          />
        ))}
      </div>
    </details>
  );
}

function groupState(group: ContentGroup): GroupState {
  if (group.steps.every((step) => step.state === "completed")) return "done";
  return group.steps.some((step) => step.evidence.length > 0) ? "partial" : "next";
}

function groupMarker(state: GroupState): ReactElement {
  if (state === "done") return <Check />;
  if (state === "partial") return <Clock3 />;
  return <ArrowRight />;
}

function groupStatus(state: GroupState, count: number): string {
  if (state === "done") return "Concluído";
  return state === "partial" ? "Em andamento" : `${count} atividades`;
}

function groupDateLabel(state: GroupState, dates: (string | null)[]): string {
  if (state === "done") return "Conteúdo registrado";
  const scheduled = dates.filter((date): date is string => Boolean(date)).toSorted();
  const first = scheduled[0];
  const last = scheduled.at(-1);
  if (!first) return "Sem data disponível";
  const period = last === first ? dateLabel(first) : `${dateLabel(first)} — ${dateLabel(last)}`;
  return dates.some((date) => !date) ? `${period} · parte sem data` : period;
}

function stepBadge(state: ProgramStep["state"]): {
  variant: "success" | "warning" | "neutral";
  label: string;
} {
  if (state === "completed") return { variant: "success", label: "Concluído" };
  if (state === "partial") return { variant: "warning", label: "Parcial" };
  return { variant: "neutral", label: "A trabalhar" };
}

function ProgramActivity({
  step,
  date,
  actions,
}: {
  step: ProgramStep;
  date: string | null;
  actions: ExplorerActions;
}): ReactElement {
  const { onClose, onEdit } = actions;
  const badge = stepBadge(step.state);
  const { plannedOn } = step.item;
  return (
    <article>
      <div className={styles.activityTitle}>
        <h4>{step.item.title}</h4>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      {step.state !== "completed" && (
        <p>
          <CalendarDays size={14} aria-hidden="true" />
          {date ? `Previsto para ${dateLabel(date)}` : "Precisa de mais tempo no calendário"}
        </p>
      )}
      {step.evidence.map((record) => (
        <Link
          key={record.id}
          href={`/turmas/${record.classId}?secao=aulas&aula=${record.id}#aulas-da-turma`}
        >
          Registro de {dateLabel(record.date)}
        </Link>
      ))}
      {onEdit && plannedOn && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onClose();
            onEdit({ ...step.item, plannedOn });
          }}
        >
          Editar atividade
        </Button>
      )}
    </article>
  );
}
