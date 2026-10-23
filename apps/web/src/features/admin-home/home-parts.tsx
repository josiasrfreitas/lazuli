import type { ReactElement } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenCheck,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { formatDateOnlyBR } from "~/lib/format";
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
const LOADING_ROWS = ["first", "second", "third", "fourth"];
export function HomeLoading(): ReactElement {
  return (
    <div role="status" aria-label="Carregando o início" className={styles.loading}>
      <InlineSkeleton className="h-10 w-64" />
      <InlineSkeleton className="h-5 w-80" />
      <div className={styles.loadingRows}>
        {LOADING_ROWS.map((key) => (
          <InlineSkeleton key={key} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
export function HomeWelcome({
  data,
  openGroup,
}: {
  data: HomeData;
  openGroup: (group: HomeGroup) => void;
}): ReactElement {
  const firstName = data.name.trim().split(/\s+/u)[0];
  const attention = data.groups.filter((group) => group.attention && group.total > 0);
  const count = attention.reduce((sum, group) => sum + group.total, 0);
  const first = attention[0] ?? data.groups.find((group) => group.total > 0);
  return (
    <header className={styles.welcome}>
      <div className={styles.welcomeCopy}>
        <h1>Olá, {firstName}.</h1>
        <p>Bom ter você por aqui. Vamos cuidar dos próximos passos?</p>
        <div className={styles.daySummary}>
          <span>
            <strong>{data.activeStudents.toLocaleString("pt-BR")}</strong> alunos ativos
          </span>
          <span>
            <strong>{data.agenda.total}</strong> compromissos ainda hoje
          </span>
        </div>
      </div>
      <div className={styles.focus}>
        {count > 0 ? <BookOpenCheck aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
        <div>
          <h2>
            {count > 0
              ? `${count} ${count === 1 ? "ação pede" : "ações pedem"} atenção`
              : "Espaço para o próximo passo"}
          </h2>
          <p>
            {count > 0
              ? "Cobertura de aulas e registros que precisam de cuidado."
              : "Nenhum alerta de cobertura ou registro neste momento."}
          </p>
          {first && (
            <Button size="sm" onClick={() => openGroup(first)}>
              {count > 0 ? "Revisar prioridades" : "Ver próximos passos"}
              <ChevronRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
export function TodayAgenda({ data, open }: { data: HomeData; open: OpenAction }): ReactElement {
  return (
    <aside className={styles.agenda} aria-labelledby="home-agenda-title">
      <div className={styles.sectionHeading}>
        <h2 id="home-agenda-title">Ainda hoje</h2>
        <CalendarDays aria-hidden="true" />
      </div>
      <p className={styles.description}>Aulas, experimentais e atendimentos.</p>
      {data.agenda.items.length === 0 ? (
        <div className={styles.quiet}>
          <CalendarDays aria-hidden="true" />
          <p>Sem novos compromissos hoje.</p>
          <span>A agenda completa continua à mão para preparar os próximos dias.</span>
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
      <Link className={styles.textLink} href={`/aulas?dia=${data.today}&visao=dia`}>
        {data.agenda.total > data.agenda.items.length
          ? `Ver os ${data.agenda.total} compromissos`
          : "Abrir agenda"}
        <ArrowUpRight aria-hidden="true" />
      </Link>
    </aside>
  );
}
export function ItemDate({ item }: { item: HomeItem }): ReactElement | null {
  return item.date ? <time dateTime={item.date}>{formatDateOnlyBR(item.date)}</time> : null;
}
