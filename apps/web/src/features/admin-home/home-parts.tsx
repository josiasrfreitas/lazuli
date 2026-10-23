import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import { Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { formatDateOnlyBR } from "~/lib/format";
import { LoadingLine } from "./home-loading";
import styles from "./home.module.css";

export type HomeData = RouterOutputs["dashboard"]["home"];
export type HomeGroup = HomeData["groups"][number];
export type HomeItem = HomeGroup["items"][number];
export type HomeAction = HomeItem["action"];
export type OpenAction = (action: HomeAction) => void;
export function HomeError({
  retry,
  children,
}: {
  retry: () => void;
  children: string;
}): ReactElement {
  return (
    <div role="alert" className={styles.feedback}>
      <p>{children}</p>
      <Button variant="secondary" size="sm" onClick={retry}>
        <RefreshCw aria-hidden="true" />
        Tentar novamente
      </Button>
    </div>
  );
}
export function HomeWelcome({ name, children }: { name: string; data: HomeData | undefined; children?: ReactNode }): ReactElement {
  const firstName = name.trim().split(/\s+/u)[0];
  return <header className={styles.welcome}><div><h1>Olá, {firstName}.</h1><p>Os alunos, as aulas e o que precisa avançar.</p></div>{children}</header>;
}
export function TodayAgenda({ data, open, loading = false, compact = false }: { data: HomeData | undefined; open: OpenAction; loading?: boolean; compact?: boolean }): ReactElement {
  if (compact && data?.agenda.total === 0) return <div className={styles.agendaQuiet}>
    <span>Sem compromissos restantes hoje.</span>
    <Link className={styles.textLink} href={`/aulas?dia=${data.today}&visao=dia`}>Abrir agenda<ArrowUpRight aria-hidden="true" /></Link>
  </div>;
  return (
    <aside className={styles.agenda} aria-labelledby="home-agenda-title">
      <div className={styles.sectionHeading}>
        <h2 id="home-agenda-title">Ainda hoje{data && data.agenda.total > 0 && <span className={styles.agendaCount}>{" "}{data.agenda.total.toLocaleString("pt-BR")}</span>}</h2>
        <CalendarDays aria-hidden="true" />
      </div>
      {(loading || (data && data.agenda.total > 0)) && <p className={styles.description}>Aulas, experimentais e atendimentos.</p>}
      {loading ? <div className={styles.agendaSkeleton} aria-label="Carregando agenda">{["a", "b", "c"].map(key => <div key={key}><LoadingLine size="short" /><div><LoadingLine /><LoadingLine size="short" /></div></div>)}</div> : !data ? <p className={styles.recordQuiet}>Agenda indisponível no momento.</p> : data.agenda.items.length === 0 ? (
        <div className={styles.quiet}>
          <p>Sem compromissos restantes hoje.</p>
        </div>
      ) : (
        <ol className={styles.agendaList}>
          {data.agenda.items.map((event) => (
            <li key={event.id}>
              <time dateTime={`${data.today}T${event.time}:00-03:00`}>{event.time}</time>
              <button type="button" onClick={() => open(event.action)}>
                <span className={styles.eventKind}>{event.kind}</span>
                <strong>{event.title}</strong>
                <span>{event.detail}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <Link className={styles.textLink} href={data ? `/aulas?dia=${data.today}&visao=dia` : "/aulas"}>
        {data && data.agenda.total > data.agenda.items.length
          ? `Ver os ${data.agenda.total.toLocaleString("pt-BR")} compromissos`
          : "Abrir agenda"}
        <ArrowUpRight aria-hidden="true" />
      </Link>
    </aside>
  );
}
export function ItemDate({ item }: { item: HomeItem }): ReactElement | null {
  return item.date ? <time dateTime={item.date}>{formatDateOnlyBR(item.date)}</time> : null;
}
