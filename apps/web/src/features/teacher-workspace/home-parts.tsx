"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, ChevronRight, RefreshCw, X } from "lucide-react";
import { Button, InlineSkeleton, PencilLoader } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { AssessmentDialog } from "~/features/assessments/assessment-dialog";
import styles from "./home.module.css";

export type HomeData = RouterOutputs["teacherWorkspace"]["home"];
export type PendingLesson = RouterOutputs["teacherWorkspace"]["pending"][number];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const DAY_MS = 86_400_000;
export const homeDate = (date: string): string =>
  dateFormatter.format(new Date(`${date}T12:00:00Z`)).replace(".", "");
export const homeLongDate = (date: string): string =>
  dayFormatter.format(new Date(`${date}T12:00:00Z`));
export function relativeHomeDate(date: string, today: string): string {
  const days = Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return homeDate(date);
}

export function HomeSection({
  id,
  title,
  count,
  description,
  children,
  busy = false,
}: {
  id: string;
  title: string;
  count: ReactNode;
  description?: string;
  children: ReactNode;
  busy?: boolean;
}): ReactElement {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={styles.section}
      tabIndex={-1}
      aria-busy={busy}
    >
      <header className={styles.sectionHeader}>
        <h2 id={`${id}-title`}>{title}</h2>
        <span className={styles.count}>{count}</span>
      </header>
      {description && <p className={styles.sectionDescription}>{description}</p>}
      {children}
    </section>
  );
}

export function HomeList<T extends { id: string }>({
  items,
  render,
  label,
  limit = 2,
}: {
  items: T[];
  render: (item: T) => ReactNode;
  label: string;
  limit?: number;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <ul className={styles.list}>
        {(expanded ? items : items.slice(0, limit)).map((item) => (
          <li key={item.id}>{render(item)}</li>
        ))}
      </ul>
      {items.length > limit && (
        <button
          type="button"
          className={styles.more}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Mostrar menos" : `Ver ${label} (${items.length})`}
          <ChevronDown aria-hidden="true" className={expanded ? styles.chevronOpen : undefined} />
        </button>
      )}
    </>
  );
}

export function HomeRow({
  title,
  description,
  children,
  href,
  onClick,
  id,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  href?: string;
  onClick?: () => void;
  id?: string;
}): ReactElement {
  const body = (
    <>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        <span>{description}</span>
        {children}
      </span>
      <ChevronRight aria-hidden="true" className={styles.rowArrow} />
    </>
  );
  return href ? (
    <Link href={href} className={styles.row} id={id}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={styles.row} id={id}>
      {body}
    </button>
  );
}

export function HomeEmpty({
  children,
  detail,
}: {
  children: ReactNode;
  detail?: string;
}): ReactElement {
  return (
    <div className={styles.empty}>
      <Check aria-hidden="true" />
      <div>
        <p>{children}</p>
        {detail && <span>{detail}</span>}
      </div>
    </div>
  );
}

const loadingSections = {
  lessons: { id: "registros", title: "Aulas por registrar", description: undefined },
  assessments: {
    id: "avaliacoes",
    title: "Avaliações por fazer",
    description: "Encontros de avaliação e notas por completar.",
  },
  appointments: {
    id: "atendimentos",
    title: "Seus atendimentos",
    description: "Próximos 7 dias e registros pendentes.",
  },
  exams: {
    id: "provas",
    title: "Provas chegando",
    description: "Previstas nos próximos 7 dias.",
  },
  planning: { id: "planejamento", title: "De olho no planejamento", description: undefined },
};

export function HomeLoading({ kind }: { kind: keyof typeof loadingSections }): ReactElement {
  const section = loadingSections[kind];
  return (
    <HomeSection {...section} count={<InlineSkeleton className="h-3 w-3 rounded-sm" />} busy>
      <span className="sr-only" role="status">
        Carregando {kind === "planning" ? "planejamento" : section.title.toLocaleLowerCase("pt-BR")}
        …
      </span>
      {kind === "lessons" ? (
        <div className={styles.nextTask} aria-hidden="true">
          <div className={styles.taskHeading}>
            <InlineSkeleton className="size-5 rounded-sm" />
            <div className="grid min-w-0 flex-1 gap-2">
              <InlineSkeleton className="h-3.5 w-48 max-w-full rounded-sm" />
              <InlineSkeleton className="h-3 w-36 max-w-full rounded-sm" />
            </div>
          </div>
          <div className={styles.taskAction}>
            <InlineSkeleton className="h-3 w-40 max-w-full rounded-sm" />
            <div className="shrink-0">
              <InlineSkeleton className="h-11 w-36 rounded-md md:h-8" />
            </div>
          </div>
        </div>
      ) : (
        <ul className={styles.list} aria-hidden="true">
          {Array.from({ length: kind === "assessments" ? 2 : 1 }, (_, index) => (
            <li key={index}>
              <div className={styles.row}>
                <div className="grid min-w-0 flex-1 gap-2">
                  <InlineSkeleton className="h-3.5 w-2/5 rounded-sm" />
                  <InlineSkeleton className="h-3 w-3/5 rounded-sm" />
                  <InlineSkeleton className="h-3 w-24 max-w-full rounded-sm" />
                </div>
                <InlineSkeleton className="size-3 rounded-sm" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </HomeSection>
  );
}

export function HomeError({
  retry,
  children,
}: {
  retry: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <div role="alert" className={styles.error}>
      <p>{children}</p>
      <Button variant="link" size="compact-responsive" onClick={retry}>
        <RefreshCw aria-hidden="true" />
        Tentar novamente
      </Button>
    </div>
  );
}

export function HomeGradeDialog({
  progressId,
  onClose,
}: {
  progressId: string;
  onClose: () => void;
}): ReactElement {
  const utils = trpc.useUtils();
  const query = trpc.assessments.byProgress.useQuery({ progressId }, { retry: false });
  if (!query.data)
    return (
      <div className={styles.gradeStatus}>
        {query.error ? (
          <span role="alert">Não foi possível abrir as notas.</span>
        ) : (
          <>
            <PencilLoader size="sm" label="Abrindo notas" />
            <span aria-hidden="true">Abrindo notas…</span>
          </>
        )}
        {query.error && (
          <Button variant="link" size="compact-responsive" onClick={() => void query.refetch()}>
            <RefreshCw aria-hidden="true" />
            Tentar novamente
          </Button>
        )}
        <Button variant="text" size="compact-responsive" onClick={onClose}>
          <X aria-hidden="true" />
          Cancelar
        </Button>
      </div>
    );
  return (
    <AssessmentDialog
      data={query.data}
      onClose={() => {
        onClose();
        void utils.teacherWorkspace.home.invalidate();
      }}
    />
  );
}

export function AgendaLink(): ReactElement {
  return (
    <Button
      variant="link"
      size="compact-responsive"
      nativeButton={false}
      render={<Link href="/professor/agenda" />}
    >
      Agenda
      <ArrowUpRight aria-hidden="true" />
    </Button>
  );
}
