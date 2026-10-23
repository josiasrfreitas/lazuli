import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, History, CalendarCheck2 } from "lucide-react";
import { Button } from "@lazuli/ui";
import { JOURNEY } from "./home-model";
import { GroupDetail } from "./group-detail";
import type { HomeData, HomeGroup, OpenAction } from "./home-parts";
import styles from "./home.module.css";

type SelectGroup = (group: HomeGroup | null) => void;
export function HomeQueue({ data, selected, select, open }: {
  data: HomeData; selected: HomeGroup | null; select: SelectGroup; open: OpenAction;
}): ReactElement {
  return (
    <section id="home-work" tabIndex={-1} className={styles.work} aria-label="Frentes de trabalho">
      {selected ? (
        <div className={styles.detailSurface} key={`${selected.kind}-${selected.period}`}>
          <GroupDetail group={selected} close={() => select(null)} open={open} />
        </div>
      ) : (
        <div className={styles.workOverview}>
          {data.groups.some(group => group.attention && group.total > 0) && <TeachingBoard groups={data.groups} select={select} />}
          <SchoolJourney groups={data.groups} select={select} open={open} newSchool={data.activeStudents === 0} />
          {!data.groups.some(group => group.attention && group.total > 0) && <TeachingBoard groups={data.groups} select={select} />}
        </div>
      )}
    </section>
  );
}
function TeachingBoard({ groups, select }: { groups: HomeGroup[]; select: SelectGroup }): ReactElement {
  const coverage = groups.find(group => group.kind === "coverage");
  const records = groups.filter(group => group.kind === "lessons" || group.kind === "appointments");
  const pending = records.filter(group => group.total > 0);
  const needsCoverage = Boolean(coverage?.total);
  return (
    <section className={styles.teaching} data-quiet={!needsCoverage && pending.length === 0} aria-labelledby="teaching-title">
      <div className={styles.sectionHeading}>
        <h2 id="teaching-title">Acompanhamento das aulas</h2>
        {!needsCoverage && <span>Professores definidos · próximos 7 dias</span>}
      </div>
      {needsCoverage && coverage && (
        <div className={styles.coverageAlert}>
          <CalendarCheck2 aria-hidden="true" />
          <div><h3>{coverage.total} {coverage.total === 1 ? "aula precisa" : "aulas precisam"} de professor</h3><p>Organizar a cobertura dos próximos 7 dias.</p></div>
          <Button size="sm" onClick={() => select(coverage)}>Definir cobertura <ArrowRight aria-hidden="true" /></Button>
        </div>
      )}
      {pending.length > 0 ? (
        <div className={styles.recentRecords}>
          <div><h3>Registros para concluir</h3><p>Encontros encerrados nos últimos 7 dias.</p></div>
          <div className={styles.recordCounters}>
            {pending.map(group => (
              <button type="button" key={group.kind} onClick={() => select(group)} className={styles.recordCounter}>
                <strong>{group.total.toLocaleString("pt-BR")}</strong>
                <span>{group.kind === "lessons" ? "aulas por registrar" : "atendimentos por registrar"}</span>
                <ArrowUpRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ) : <p className={styles.recordQuiet}>Sem registros pendentes nos últimos 7 dias.</p>}
      <div className={styles.historyLinks}>
        <History aria-hidden="true" />
        <span>Histórico anterior</span>
        {records.filter(group => (group.historyTotal ?? 0) > 0).map(group => (
          <button type="button" key={group.kind} onClick={() => select({ ...group, period: "history" })}>
            {group.historyTotal?.toLocaleString("pt-BR")} {group.kind === "lessons" ? "aulas" : "atendimentos"} por registrar <ArrowUpRight aria-hidden="true" />
          </button>
        ))}
        {records.every(group => !group.historyTotal) && <span>nenhum registro pendente</span>}
      </div>
    </section>
  );
}
function SchoolJourney({ groups, select, open, newSchool }: { groups: HomeGroup[]; select: SelectGroup; open: OpenAction; newSchool: boolean }): ReactElement {
  const stages = JOURNEY.filter(stage => groups.some(group => stage.groups.includes(group.kind) && group.total > 0));
  const next = groups.some(group => group.attention && group.total > 0) ? undefined : groups.find(group => !group.attention && group.total > 0);
  const actionLabels: Record<string, string> = { placement: "Corrigir nivelamentos", allocation: "Encontrar uma turma", students: "Definir turmas", semester: "Revisar alocações", contracts: "Preparar contratos", renewals: "Conversar sobre renovação" };
  return (
    <section className={styles.journey} aria-labelledby="journey-title">
      <div className={styles.sectionHeading}>
        <h2 id="journey-title">Próximos passos</h2>
        {next ? <Button size="sm" onClick={() => select(next)}>{actionLabels[next.kind]}<ArrowRight aria-hidden="true" /></Button> : <span>Da chegada à renovação</span>}
      </div>
      {newSchool && <p className={styles.firstSteps}>Comece pelo cadastro de um aluno ou acompanhe quem já demonstrou interesse. <Link className={styles.textLink} href="/alunos">Abrir alunos <ArrowUpRight aria-hidden="true" /></Link></p>}
      {stages.length === 0 && <p className={styles.recordQuiet}>Nenhum próximo passo pendente na jornada dos alunos.</p>}
      <div className={styles.journeyTrack}>
        {stages.map(stage => (
          <section className={styles.journeyStage} key={stage.key}>
            <h3>{stage.title}<ArrowRight aria-hidden="true" /></h3>
            <div className={styles.journeyActions}>
              {stage.groups.map((kind, index) => {
                const group = groups.find(item => item.kind === kind);
                if (!group || group.total === 0) return null;
                return (
                  <div className={styles.journeyCell} key={kind} data-pending={group.total > 0}>
                    <button type="button" onClick={() => select(group)} className={styles.journeyAction}>
                      <span>{stage.labels[index]}</span>
                      <strong>{group.total.toLocaleString("pt-BR")}</strong>
                      <ArrowUpRight aria-hidden="true" />
                    </button>
                    {group.total > 0 && group.items[0] && (
                      <button type="button" className={styles.personPreview} onClick={() => open(group.items[0]!.action)} title={group.items[0].detail}>
                        <span>{group.items[0].title}</span>
                        <span>{group.items[0].detail}</span>
                        <ArrowUpRight aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
