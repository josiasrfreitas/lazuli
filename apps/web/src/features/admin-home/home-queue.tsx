import type { ReactElement } from "react";
import { ArrowRight, ArrowUpRight, History } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import { GroupDetail } from "./group-detail";
import { pedagogicalGroups, WORK_COPY, WORKSTREAMS } from "./home-work-model";
import type { HomeData, HomeGroup, OpenAction } from "./home-parts";
import styles from "./home.module.css";

export type SelectGroup = (group: HomeGroup | null) => void;

export function HomeQueue({ data, selected, select, open }: { data: HomeData; selected: HomeGroup | null; select: SelectGroup; open: OpenAction }): ReactElement {
  if (selected) return <section id="home-work" tabIndex={-1} className={styles.detailSurface} aria-labelledby="home-work-title">
    <GroupDetail key={`${selected.kind}-${selected.period}`} group={selected} close={() => select(null)} open={open} />
  </section>;

  const [first, ...remaining] = pedagogicalGroups(data.groups);
  const history = data.groups.filter(group => (group.historyTotal ?? 0) > 0);
  const streams = WORKSTREAMS.map(stream => ({
    title: stream.title,
    groups: remaining.filter(group => (stream.kinds as readonly string[]).includes(group.kind)),
  })).filter(stream => stream.groups.length > 0);

  return <section id="home-work" tabIndex={-1} className={styles.pedagogicalWork} aria-label="Prioridades pedagógicas" data-quiet={!first}>
    {first ? <>
      <div className={styles.sectionHeading}><h2>Prioridades pedagógicas</h2><span className={styles.workScope}>Situação atual da escola</span></div>
      <div className={styles.priorityTask} data-attention={first.attention}>
        <strong className={styles.priorityCount}>{first.total.toLocaleString("pt-BR")}</strong>
        <div className={styles.priorityBody}>
          <h3>{first.title}</h3>
          <p>{WORK_COPY[first.kind].outcome}</p>
          <div className={styles.priorityScope}>{first.attention && <Badge variant="warning">Prioridade</Badge>}<span>{WORK_COPY[first.kind].scope}</span></div>
        </div>
        <Button size="sm" onClick={() => select(first)}>{WORK_COPY[first.kind].action}<ArrowRight aria-hidden="true" /></Button>
      </div>
      {streams.length > 0 && <div className={styles.workstreams}>{streams.map(stream => <div className={styles.workstream} key={stream.title}>
        <h3>{stream.title}</h3>
        <div>{stream.groups.map(group => <button type="button" className={styles.workTask} key={group.kind} onClick={() => select(group)}>
          <strong data-attention={group.attention}>{group.total.toLocaleString("pt-BR")}</strong>
          <span><span>{group.title}</span><small>{WORK_COPY[group.kind].action}</small></span>
          <ArrowUpRight aria-hidden="true" />
        </button>)}</div>
      </div>)}</div>}
    </> : <p className={styles.workQuiet}>Nenhuma pendência pedagógica atual.</p>}
    {history.length > 0 && <div className={styles.historyLinks}><History aria-hidden="true" /><span>Registros anteriores aos últimos 7 dias</span>{history.map(group => <button type="button" key={group.kind} onClick={() => select({ ...group, period: "history" })}>{group.historyTotal?.toLocaleString("pt-BR")} {group.kind === "lessons" ? "aulas" : "atendimentos"}<ArrowUpRight aria-hidden="true" /></button>)}</div>}
  </section>;
}
