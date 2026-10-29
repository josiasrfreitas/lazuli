import type { ReactElement } from "react";
import { useQueryState } from "nuqs";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import agenda from "~/features/appointments/student-carousel.module.css";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { StudentDeskLoading } from "~/features/pedagogical-follow-up/student-desk-loading";
import desk from "~/features/pedagogical-follow-up/student-desk.module.css";
import styles from "./student-loading.module.css";

export function EnrollmentLoading(): ReactElement {
  return (
    <article
      aria-label="Carregando matrícula"
      aria-busy="true"
      className={`min-w-0 border border-border bg-accent ${styles.surface}`}
    >
      <div className="grid gap-5 px-5 py-4 lg:grid-cols-2 lg:gap-8">
        <div className={`grid content-start gap-3 ${styles.intro}`}>
          <InlineSkeleton className="h-7 w-48" />
          <InlineSkeleton className="h-3 w-64 max-w-full" />
          <div className="flex gap-5">
            <InlineSkeleton className="h-4 w-24" />
            <InlineSkeleton className="h-4 w-32" />
          </div>
          <InlineSkeleton className="h-4 w-48" />
          <div className="border-t border-border/60 pt-2">
            <InlineSkeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 border-t sm:grid-cols-2 border-border/60 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <div className={`flex min-w-0 flex-col gap-3 ${styles.metric}`}>
            <InlineSkeleton className="h-4 w-24" />
            <InlineSkeleton className="h-10 w-20" />
            <InlineSkeleton className="h-3 w-28" />
            <InlineSkeleton className="h-1.5 w-full" />
            <div className="flex gap-4">
              <InlineSkeleton className="h-5 w-20" />
              <InlineSkeleton className="h-5 w-20" />
            </div>
            <InlineSkeleton className="mt-auto h-8 w-36" />
          </div>
          <div className={`flex min-w-0 flex-col gap-3 ${styles.metric}`}>
            <InlineSkeleton className="h-4 w-24" />
            <InlineSkeleton className="h-10 w-20" />
            <InlineSkeleton className="h-3 w-28" />
            <InlineSkeleton className="h-3 w-24" />
            <InlineSkeleton className="mt-auto h-8 w-36" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function FollowUpLoading(): ReactElement {
  return (
    <section className={desk.workspace} aria-busy="true" aria-label="Carregando acompanhamento">
      <header className={desk.heading}>
        <div>
          <h2>Acompanhamento pedagógico</h2>
          <p>Ocorrências, tratativas e evoluções do aluno.</p>
        </div>
        <Button size="sm" disabled>
          Registrar ocorrência
        </Button>
      </header>
      <StudentDeskLoading />
    </section>
  );
}

export function PedagogyLoading(): ReactElement {
  const [requested] = useQueryState("definirTurma");
  if (requested === "1") return <FirstClassLoading />;
  return (
    <div className="grid min-w-0 gap-6">
      <EnrollmentLoading />
      <FollowUpLoading />
    </div>
  );
}

export function AppointmentsLoading({
  canSchedule = false,
}: {
  canSchedule?: boolean;
}): ReactElement {
  return (
    <section className={agenda.agenda} aria-label="Carregando atendimentos" aria-busy="true">
      <header className={agenda.heading}>
        <h2>
          <CalendarDays aria-hidden="true" />
          Atendimentos <InlineSkeleton className="h-3 w-4" />
        </h2>
        <div className={agenda.actions}>
          <Button size="sm" variant="link" disabled>
            Ver agenda
          </Button>
          {canSchedule && (
            <Button size="sm" variant="secondary" disabled>
              <CalendarDays aria-hidden="true" /> Agendar atendimento
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" disabled aria-label="Atendimentos anteriores">
            <ArrowLeft />
          </Button>
          <Button size="icon-sm" variant="ghost" disabled aria-label="Próximos atendimentos">
            <ArrowRight />
          </Button>
        </div>
      </header>
      <AppointmentsRailLoading />
    </section>
  );
}

function AppointmentsRailLoading(): ReactElement {
  return (
    <ul className={`${agenda.rail} ${styles.loadingRail}`} aria-hidden="true">
      {Array.from({ length: 16 }, (_value, item) => (
        <li key={item}>
          <div className={agenda.cell}>
            <div className={agenda.date}>
              <strong>
                <InlineSkeleton className="h-8 w-8 rounded-sm" />
              </strong>
              <span>
                <InlineSkeleton className="h-3 w-16" />
              </span>
            </div>
            <div className={agenda.body}>
              <strong>
                <InlineSkeleton className="h-3.5 w-28 max-w-full rounded-sm" />
              </strong>
              <span className={agenda.reason}>
                {[0, 1].map((line) => (
                  <span key={line} className="flex h-5 items-center">
                    <InlineSkeleton
                      className={
                        line === 1
                          ? "h-3 w-24 max-w-full rounded-sm"
                          : "h-3 w-40 max-w-full rounded-sm"
                      }
                    />
                  </span>
                ))}
              </span>
              <div className={agenda.meta}>
                <InlineSkeleton className="h-3 w-16" />
                <InlineSkeleton className="h-5 w-16" />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FirstClassLoading(): ReactElement {
  return (
    <div
      className="flex min-h-full min-w-0 flex-col"
      role="status"
      aria-busy="true"
      aria-label="Carregando dados pedagógicos"
    >
      <span className="sr-only">Carregando dados pedagógicos do aluno…</span>
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16"
        aria-hidden="true"
      >
        <InlineSkeleton className="mb-2 size-12" />
        <InlineSkeleton className="h-7 w-80 max-w-full" />
        <InlineSkeleton className="h-4 w-96 max-w-full" />
        <InlineSkeleton className="h-4 w-72 max-w-full" />
        <InlineSkeleton className="h-10 w-48" />
      </div>
      <div className="flex items-center justify-center gap-3 py-6" aria-hidden="true">
        <InlineSkeleton className="size-5" />
        <InlineSkeleton className="h-4 w-56 max-w-full" />
      </div>
    </div>
  );
}
