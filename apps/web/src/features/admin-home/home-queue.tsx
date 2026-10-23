import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, History, CalendarClock, Users, GraduationCap, FileText, UserRoundPlus } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import { GroupDetail } from "./group-detail";
import type { HomeData, HomeGroup, OpenAction } from "./home-parts";
import styles from "./home.module.css";

type SelectGroup = (group: HomeGroup | null) => void;
const LABELS: Record<string, string> = { placement: "Nivelamentos para corrigir", allocation: "Leads aguardando turma", students: "Alunos sem turma", semester: "Alocações para publicar", contracts: "Primeiros contratos", renewals: "Renovações a conversar" };
const ACTIONS: Record<string, string> = { coverage: "Definir professor", lessons: "Registrar aulas", appointments: "Registrar atendimentos", placement: "Corrigir nivelamentos", allocation: "Encontrar uma turma", students: "Definir turmas", semester: "Revisar alocações", contracts: "Preparar contratos", renewals: "Revisar renovações" };
export function HomeAttention({ data, select }: { data: HomeData; select: SelectGroup }): ReactElement | null {
  const groups = data.groups.filter(group => group.attention && group.total > 0);
  const first = groups[0];
  if (!first) return null;
  return <section className={styles.attention} aria-label="Precisa de atenção">
    <div className={styles.attentionTitle}><CalendarClock aria-hidden="true" /><div><h2>{first.kind === "coverage" ? "Há aulas sem professor" : "Há registros para concluir"}</h2><p>{first.kind === "coverage" ? "Cobertura dos próximos 7 dias" : "Encontros encerrados nos últimos 7 dias"}</p></div></div>
    <div className={styles.attentionCounts}>{groups.map(group => <button type="button" key={group.kind} onClick={() => select(group)}><strong>{group.total.toLocaleString("pt-BR")}</strong><span>{group.kind === "coverage" ? "sem professor" : group.kind === "lessons" ? "aulas por registrar" : "atendimentos por registrar"}</span><ArrowUpRight aria-hidden="true" /></button>)}</div>
    <Button size="sm" onClick={() => select(first)}>{ACTIONS[first.kind]}<ArrowRight aria-hidden="true" /></Button>
  </section>;
}
export function HomeQueue({ data, selected, select, open }: { data: HomeData; selected: HomeGroup | null; select: SelectGroup; open: OpenAction }): ReactElement {
  const pending = data.groups.filter(group => !group.attention && group.total > 0);
  const history = data.groups.filter(group => (group.historyTotal ?? 0) > 0);
  return <section id="home-work" tabIndex={-1} className={selected ? styles.detailSurface : styles.queuePanel} aria-label="Próximos passos">
    {selected ? <GroupDetail key={`${selected.kind}-${selected.period}`} group={selected} close={() => select(null)} open={open} /> : <>
      <div className={styles.sectionHeading}><h2>Próximos passos</h2>{pending.length > 0 && <Badge variant="neutral">{pending.length} {pending.length === 1 ? "frente" : "frentes"}</Badge>}</div>
      {pending.length > 0 ? <>
        <p className={styles.description}>Continue de onde a escola precisa.</p>
        <div className={styles.queueGrid}>{pending.map(group => {
          const Icon = group.area === "finance" ? FileText : group.area === "admissions" ? UserRoundPlus : group.kind === "semester" ? GraduationCap : Users;
          return <button className={styles.queueTile} type="button" key={group.kind} onClick={() => select(group)}>
            <div className={styles.queueTileTop}><Icon aria-hidden="true" /><strong>{group.total.toLocaleString("pt-BR")}</strong><ArrowUpRight aria-hidden="true" /></div>
            <h3>{LABELS[group.kind]}</h3><span>{ACTIONS[group.kind]} <ArrowRight aria-hidden="true" /></span>
          </button>;
        })}</div>
      </> : <div className={styles.queueQuiet}>
        <p>{data.school.totalStudents === 0 ? "A escola começa com o primeiro aluno." : "Nenhum próximo passo pendente."}</p>
        <Link className={styles.textLink} href={data.school.totalStudents === 0 ? "/alunos" : "/organizacao"}>{data.school.totalStudents === 0 ? "Cadastrar alunos" : "Explorar turmas"}<ArrowUpRight aria-hidden="true" /></Link>
      </div>}
      {history.length > 0 && <div className={styles.historyLinks}><History aria-hidden="true" /><span>Registros anteriores</span>{history.map(group => <button type="button" key={group.kind} onClick={() => select({ ...group, period: "history" })}>{group.historyTotal?.toLocaleString("pt-BR")} {group.kind === "lessons" ? "aulas" : "atendimentos"}<ArrowUpRight aria-hidden="true" /></button>)}</div>}
    </>}
  </section>;
}
