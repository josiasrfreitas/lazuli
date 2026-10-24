import type { ReactElement } from "react";
import { ArrowRight, ArrowUpRight, Clock3 } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import type { HomeData, OpenAction } from "./home-parts";
import type { SelectGroup } from "./home-queue";
import { caseTiming, formatWorkDate, WORK_COPY, type WorkPriority } from "./home-work-model";
import styles from "./home.module.css";

export function PriorityWork({
  work,
  today,
  select,
  open,
}: {
  work: WorkPriority;
  today: HomeData["today"];
  select: SelectGroup;
  open: OpenAction;
}): ReactElement {
  const { group } = work;
  const first = group.items[0];
  const timing = first?.timing;
  const isMeeting = timing?.kind === "meeting";
  const isEntry = timing?.kind === "entry";
  const direct = isMeeting && first;
  const figure = isMeeting
    ? timing.startTime
    : isEntry
      ? formatWorkDate(timing.date)
      : group.total.toLocaleString("pt-BR");
  const figureLabel = isMeeting
    ? `Aula de ${formatWorkDate(timing.date)}`
    : isEntry
      ? "Primeira entrada prevista"
      : group.title;
  const countLabel = isMeeting
    ? group.total === 1
      ? "aula sem professor"
      : "aulas sem professor"
    : group.total === 1
      ? "entrada em turma por confirmar"
      : "entradas em turma por confirmar";
  const outcome =
    work.state === "date-passed"
      ? "A entrada precisa de uma data atual ou futura. Confira as datas e as turmas propostas."
      : WORK_COPY[group.kind].outcome;
  return (
    <article
      className={styles.priorityTask}
      data-tone={work.tone}
      data-state={work.state}
      data-cases={group.items.length > 0}
      aria-labelledby="home-priority-title"
    >
      <div className={styles.priorityMain}>
        <div className={styles.priorityFigure} data-date={isEntry || isMeeting}>
          <strong>{figure}</strong>
          <span>{figureLabel}</span>
          {(isEntry || isMeeting) && (
            <small>
              {group.total.toLocaleString("pt-BR")} {countLabel}
            </small>
          )}
        </div>
        <div className={styles.priorityBody}>
          <h3 id="home-priority-title">{work.headline}</h3>
          <div className={styles.priorityScope}>
            <Badge variant={work.tone}>{work.label}</Badge>
          </div>
          <p>{outcome}</p>
          <div className={styles.priorityActions}>
            <Button size="sm" onClick={() => (direct ? open(direct.action) : select(group))}>
              {work.action}
              <ArrowRight aria-hidden="true" />
            </Button>
            {direct && group.total > 1 && (
              <button type="button" className={styles.textAction} onClick={() => select(group)}>
                Ver as {group.total} aulas
                <ArrowUpRight aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
      {first && (
        <div className={styles.priorityCases}>
          <p className={styles.caseContext}>
            <Clock3 aria-hidden="true" />
            {work.evidence}
          </p>
          <div className={styles.caseGrid}>
            {group.items.slice(0, 3).map((item) => (
              <button
                type="button"
                className={styles.priorityCase}
                key={item.id}
                onClick={() => open(item.action)}
              >
                <span className={styles.caseName}>
                  {item.title}
                  <ArrowUpRight aria-hidden="true" />
                </span>
                <span>{caseTiming(item, today) ?? item.detail}</span>
                {item.timing && <small>{item.detail}</small>}
              </button>
            ))}
          </div>
          {group.total > group.items.length && (
            <button type="button" className={styles.textAction} onClick={() => select(group)}>
              Ver todos · {group.total.toLocaleString("pt-BR")}
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
