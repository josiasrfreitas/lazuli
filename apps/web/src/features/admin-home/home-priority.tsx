import type { ReactElement } from "react";
import { ArrowRight, ArrowUpRight, Clock3 } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import type { HomeData, HomeItem, OpenAction } from "./home-parts";
import type { SelectGroup } from "./home-queue";
import { caseTiming, formatWorkDate, WORK_COPY, type WorkPriority } from "./home-work-model";
import styles from "./home.module.css";

const PREVIEW_SIZE = 3;
type PriorityProps = {
  work: WorkPriority;
  today: HomeData["today"];
  select: SelectGroup;
  open: OpenAction;
};
function figureContent(work: WorkPriority): {
  figure: string;
  label: string;
  isDate: boolean;
  countLabel: string;
} {
  const timing = work.group.items[0]?.timing;
  const total = work.group.total;
  if (timing?.kind === "meeting")
    return {
      figure: timing.startTime,
      label: `Aula de ${formatWorkDate(timing.date)}`,
      isDate: true,
      countLabel: total === 1 ? "aula sem professor" : "aulas sem professor",
    };
  if (timing?.kind === "entry")
    return {
      figure: formatWorkDate(timing.date),
      label: "Primeira entrada prevista",
      isDate: true,
      countLabel:
        total === 1 ? "entrada em turma por confirmar" : "entradas em turma por confirmar",
    };
  return {
    figure: total.toLocaleString("pt-BR"),
    label: work.group.title,
    isDate: false,
    countLabel: "",
  };
}
export function PriorityWork(props: PriorityProps): ReactElement {
  const { work } = props;
  const first = work.group.items[0];
  return (
    <article
      className={styles.priorityTask}
      data-tone={work.tone}
      data-state={work.state}
      data-cases={work.group.items.length > 0}
      aria-labelledby="home-priority-title"
    >
      <div className={styles.priorityMain}>
        <PriorityFigure work={work} />
        <PriorityBody {...props} direct={first?.timing?.kind === "meeting" ? first : undefined} />
      </div>
      {first && <PriorityCases {...props} />}
    </article>
  );
}
function PriorityFigure({ work }: { work: WorkPriority }): ReactElement {
  const { figure, label, isDate, countLabel } = figureContent(work);
  return (
    <div className={styles.priorityFigure} data-date={isDate}>
      <strong>{figure}</strong>
      <span>{label}</span>
      {isDate && (
        <small>
          {work.group.total.toLocaleString("pt-BR")} {countLabel}
        </small>
      )}
    </div>
  );
}
function PriorityBody({
  work,
  direct,
  select,
  open,
}: PriorityProps & { direct: HomeItem | undefined }): ReactElement {
  const outcome =
    work.state === "date-passed"
      ? "A entrada precisa de uma data atual ou futura. Confira as datas e as turmas propostas."
      : WORK_COPY[work.group.kind].outcome;
  return (
    <div className={styles.priorityBody}>
      <h3 id="home-priority-title">{work.headline}</h3>
      <div className={styles.priorityScope}>
        <Badge variant={work.tone}>{work.label}</Badge>
      </div>
      <p>{outcome}</p>
      <div className={styles.priorityActions}>
        <Button size="sm" onClick={() => (direct ? open(direct.action) : select(work.group))}>
          {work.action}
          <ArrowRight aria-hidden="true" />
        </Button>
        {direct && work.group.total > 1 && (
          <button type="button" className={styles.textAction} onClick={() => select(work.group)}>
            Ver as {work.group.total} aulas
            <ArrowUpRight aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
function PriorityCases({ work, today, select, open }: PriorityProps): ReactElement {
  const { group } = work;
  return (
    <div className={styles.priorityCases}>
      <p className={styles.caseContext}>
        <Clock3 aria-hidden="true" />
        {work.evidence}
      </p>
      <div className={styles.caseGrid}>
        {group.items.slice(0, PREVIEW_SIZE).map((item) => (
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
  );
}
