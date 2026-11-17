"use client";
import type { ReactElement } from "react";
import Link from "next/link";
import { Check, Clock3, ArrowRight, CalendarDays } from "lucide-react";
import { Badge, Button, Dialog, DialogPortal, DialogBackdrop, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@lazuli/ui";
import { dateLabel, type Planning, type PlannedItem } from "./shared";
import { type ContentGroup } from "./outlook-model";
import styles from "./program-explorer.module.css";

export function ProgramExplorer({ data, groups, onClose, onEdit }: {
  data: Planning; groups: ContentGroup[]; onClose: () => void;
  onEdit?: ((item: PlannedItem) => void) | undefined;
}): ReactElement {
  const steps = groups.flatMap((group) => group.steps);
  const completed = steps.filter((step) => step.state === "completed").length;
  const units = [...new Set(groups.map((group) => group.unit))];
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogPortal><DialogBackdrop /><DialogContent className="md:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Explore a programação</DialogTitle>
        <DialogDescription>{completed} de {steps.length} atividades concluídas · {data.scope.stage.name}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className={styles.overview}>
          <progress max={steps.length || 1} value={completed} aria-label="Atividades concluídas" />
          <p>As próximas datas acompanham as aulas disponíveis e o conteúdo que ainda falta concluir.</p>
        </div>
        <div className={styles.units}>
          {units.map((unit) => <section key={unit} className={styles.unit} aria-label={unit}>
            <h3>{unit}<span>{groups.filter((g) => g.unit === unit).flatMap((g) => g.steps).filter((s) => s.state === "completed").length} concluídas</span></h3>
            {groups.filter((group) => group.unit === unit).map((group) => {
              const done = group.steps.every((step) => step.state === "completed");
              const partial = group.steps.some((step) => step.evidence.length > 0) && !done;
              const dates = group.steps.filter((step) => step.state !== "completed").map((step) => data.projection.find((row) => row.itemId === step.item.id)?.date ?? null);
              const scheduled = dates.filter((date): date is string => Boolean(date)).sort();
              return <details key={group.id} className={styles.group} data-state={done ? "done" : partial ? "partial" : "next"}>
                <summary>
                  <span className={styles.marker}>{done ? <Check /> : partial ? <Clock3 /> : <ArrowRight />}</span>
                  <span className={styles.name}><strong>{group.title}</strong><span>{done ? "Concluído" : partial ? "Em andamento" : `${group.steps.length} atividades`}</span></span>
                  <span className={styles.date}>{done ? "Conteúdo registrado" : scheduled.length ? `${dateLabel(scheduled[0]!)}${scheduled.at(-1) !== scheduled[0] ? ` — ${dateLabel(scheduled.at(-1)!)}` : ""}` : "Sem data disponível"}{dates.some((date) => !date) && scheduled.length > 0 ? " · parte sem data" : ""}</span>
                </summary>
                <div className={styles.activities}>{group.steps.map((step) => {
                  const projection = data.projection.find((row) => row.itemId === step.item.id)?.date;
                  return <article key={step.item.id}>
                    <div className={styles.activityTitle}><h4>{step.item.title}</h4><Badge variant={step.state === "completed" ? "success" : step.state === "partial" ? "warning" : "neutral"}>{step.state === "completed" ? "Concluído" : step.state === "partial" ? "Parcial" : "A trabalhar"}</Badge></div>
                    {step.state !== "completed" && <p><CalendarDays size={14} aria-hidden="true" />{projection ? `Previsto para ${dateLabel(projection)}` : "Precisa de mais tempo no calendário"}</p>}
                    {step.evidence.map((record) => <Link key={record.id} href={`/turmas/${record.classId}?secao=aulas&aula=${record.id}#aulas-da-turma`}>Registro de {dateLabel(record.date)}</Link>)}
                    {onEdit && step.item.plannedOn && <Button size="sm" variant="ghost" onClick={() => { onClose(); onEdit({ ...step.item, plannedOn: step.item.plannedOn! }); }}>Editar atividade</Button>}
                  </article>;
                })}</div>
              </details>;
            })}
          </section>)}
        </div>
      </DialogBody>
    </DialogContent></DialogPortal>
  </Dialog>;
}
