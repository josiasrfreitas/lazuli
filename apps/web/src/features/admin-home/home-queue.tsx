import type { ReactElement } from "react";
import { ArrowUpRight, History } from "lucide-react";
import { Badge } from "@lazuli/ui";
import { GroupDetail } from "./group-detail";
import { PriorityWork } from "./home-priority";
import { prioritizedWork, WORKSTREAMS } from "./home-work-model";
import type { HomeData, HomeGroup, OpenAction } from "./home-parts";
import styles from "./home.module.css";

export type SelectGroup = (group: HomeGroup | null) => void;
export function HomeQueue({
  data,
  selected,
  select,
  open,
  agenda,
}: {
  data: HomeData;
  selected: HomeGroup | null;
  select: SelectGroup;
  open: OpenAction;
  agenda?: ReactElement;
}): ReactElement {
  if (selected)
    return (
      <section
        id="home-work"
        tabIndex={-1}
        className={styles.detailSurface}
        aria-labelledby="home-work-title"
      >
        <GroupDetail
          key={`${selected.kind}-${selected.period}`}
          group={selected}
          close={() => select(null)}
          open={open}
        />
      </section>
    );
  const [first, ...remaining] = prioritizedWork(data);
  const history = data.groups.filter((group) => (group.historyTotal ?? 0) > 0);
  // Preserve urgency order between workstreams as well as inside each one.
  const streams = WORKSTREAMS.map((stream) => ({
    title: stream.title,
    work: remaining.filter((item) => (stream.kinds as readonly string[]).includes(item.group.kind)),
  }))
    .filter((stream) => stream.work.length > 0)
    .sort((a, b) => a.work[0]!.rank - b.work[0]!.rank);
  return (
    <section
      id="home-work"
      tabIndex={-1}
      className={styles.pedagogicalWork}
      aria-label="Prioridades pedagógicas"
      data-quiet={!first}
    >
      {first ? (
        <>
          <div className={styles.workGrid} data-agenda={Boolean(agenda)}>
            <div className={styles.priorityColumn}>
              <div className={styles.sectionHeading}>
                <h2>Prioridades pedagógicas</h2>
                <span className={styles.workScope}>
                  Situação atual · por proximidade e acompanhamento
                </span>
              </div>
              <PriorityWork work={first} today={data.today} select={select} open={open} />
            </div>
            {agenda}
          </div>
          {streams.length > 0 && (
            <div className={styles.workstreams}>
              {streams.map((stream) => (
                <section className={styles.workstream} key={stream.title} aria-label={stream.title}>
                  <h3>{stream.title}</h3>
                  <div>
                    {stream.work.map((work) => (
                      <button
                        type="button"
                        className={styles.workTask}
                        data-tone={work.tone}
                        key={work.group.kind}
                        onClick={() => select(work.group)}
                      >
                        <span className={styles.workTaskHeading}>
                          <strong>{work.group.total.toLocaleString("pt-BR")}</strong>
                          <span>{work.group.title}</span>
                          <ArrowUpRight aria-hidden="true" />
                        </span>
                        <span className={styles.workTaskState}>
                          <Badge variant={work.tone}>{work.label}</Badge>
                        </span>
                        <span className={styles.workTaskEvidence}>{work.evidence}</span>
                        <span className={styles.workTaskAction}>
                          {work.action}
                          <ArrowUpRight aria-hidden="true" />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className={styles.workQuiet}>Nenhuma pendência pedagógica atual.</p>
      )}
      {history.length > 0 && (
        <div className={styles.historyLinks}>
          <History aria-hidden="true" />
          <span>Registros anteriores aos últimos 7 dias</span>
          {history.map((group) => (
            <button
              type="button"
              key={group.kind}
              onClick={() => select({ ...group, period: "history" })}
            >
              {group.historyTotal?.toLocaleString("pt-BR")}{" "}
              {group.kind === "lessons" ? "aulas" : "atendimentos"}
              <ArrowUpRight aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
