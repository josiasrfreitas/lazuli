"use client";

import type { ReactElement } from "react";
import { BookOpenCheck, CalendarClock, ClipboardCheck, Route, UsersRound, X } from "lucide-react";
import { InlineSkeleton } from "@lazuli/ui";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { schoolToday } from "~/features/class-records/calendar-model";
import {
  AgendaLink,
  HomeError,
  HomeGradeDialog,
  HomeLoading,
  homeLongDate,
  type HomeData,
} from "./home-parts";
import {
  AppointmentsSection,
  AssessmentSection,
  ExamsSection,
  HomeSignoff,
  LessonSection,
  PacingSection,
} from "./home-sections";
import { useTeacherHome, type HomeState } from "./home-state";
import { TeacherVisitDialog } from "./visits";
import styles from "./home.module.css";

export function TeacherHome(): ReactElement {
  const state = useTeacherHome();
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <HomeWelcome name={state.firstName} today={state.home.data?.today ?? schoolToday()} />
        {(state.home.data || state.home.isPending) && (
          <HomeOverview
            data={state.home.data}
            lessons={state.pending.data?.length}
            lessonsPending={state.pending.isPending}
          />
        )}
        <HomeFeedback {...state} />
        <HomeColumns {...state} />
        {state.home.data && <HomeSignoff />}
      </div>
      <HomeDialogs {...state} />
    </div>
  );
}

function HomeWelcome({ name, today }: { name: string | undefined; today: string }): ReactElement {
  return (
    <>
      <header className={styles.header}>
        <div>
          <h1>{name ? `Olá, ${name}.` : "Seu início"}</h1>
          <p>
            <time dateTime={today}>{homeLongDate(today)}</time>
          </p>
        </div>
        <AgendaLink />
      </header>
      <p className={styles.welcome}>Bom ter você por aqui. Vamos cuidar das próximas aulas?</p>
    </>
  );
}

function HomeFeedback({ home, pending, celebration, dismissCelebration }: HomeState): ReactElement {
  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {celebration &&
          (pending.data?.length === 0 ? (
            <span className="sr-only">{celebration}</span>
          ) : (
            <div className={styles.celebration}>
              <BookOpenCheck aria-hidden="true" />
              <p>{celebration}</p>
              <button type="button" onClick={dismissCelebration} aria-label="Dispensar mensagem">
                <X aria-hidden="true" />
              </button>
            </div>
          ))}
      </div>
      {home.error && (
        <HomeError retry={() => void home.refetch()}>
          Não foi possível atualizar seu resumo. Tente novamente para conferir os avisos.
        </HomeError>
      )}
    </>
  );
}

function HomeColumns({
  home,
  pending,
  setLesson,
  setAssessment,
  setAppointment,
  setVisit,
  celebration,
}: HomeState): ReactElement {
  return (
    <div className={styles.columns}>
      <div className={styles.column}>
        {pending.isPending ? (
          <HomeLoading kind="lessons" />
        ) : pending.error ? (
          <HomeError retry={() => void pending.refetch()}>
            Não foi possível atualizar as aulas por registrar.
          </HomeError>
        ) : (
          pending.data && (
            <LessonSection
              lessons={pending.data}
              open={setLesson}
              celebrate={Boolean(celebration)}
            />
          )
        )}
        {home.isPending ? (
          <HomeLoading kind="assessments" />
        ) : (
          home.data && (
            <AssessmentSection
              data={home.data}
              openGrades={setAssessment}
              openAppointment={setAppointment}
            />
          )
        )}
        {home.isPending ? (
          <HomeLoading kind="appointments" />
        ) : (
          home.data && (
            <AppointmentsSection data={home.data} open={setAppointment} openVisit={setVisit} />
          )
        )}
      </div>
      {(home.data || home.isPending) && (
        <div className={styles.column}>
          {home.isPending ? (
            <>
              <HomeLoading kind="exams" />
              <HomeLoading kind="planning" />
            </>
          ) : (
            home.data && (
              <>
                <ExamsSection data={home.data} />
                <PacingSection data={home.data} />
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}

function HomeDialogs({
  lesson,
  assessment,
  appointment,
  visit,
  setLesson,
  setAssessment,
  setAppointment,
  setVisit,
}: HomeState): ReactElement {
  return (
    <>
      {lesson && <ClassRecordDialog id={lesson} onClose={() => setLesson(null)} />}
      {assessment && (
        <HomeGradeDialog progressId={assessment} onClose={() => setAssessment(null)} />
      )}
      {appointment && (
        <StudentAppointmentDialog
          key={appointment}
          id={appointment}
          admin={false}
          onClose={() => setAppointment(null)}
          onSelect={setAppointment}
        />
      )}
      {visit && <TeacherVisitDialog id={visit} onClose={() => setVisit(null)} />}
    </>
  );
}

function HomeOverview({
  data,
  lessons,
  lessonsPending,
}: {
  data: HomeData | undefined;
  lessons: number | undefined;
  lessonsPending: boolean;
}): ReactElement {
  const items = [
    { id: "registros", count: lessons, label: "Aulas por registrar", icon: BookOpenCheck },
    {
      id: "avaliacoes",
      count: data ? data.assessments.length + data.assessmentAppointments.length : undefined,
      label: "Avaliações por fazer",
      icon: ClipboardCheck,
    },
    { id: "provas", count: data?.exams.length, label: "Provas chegando", icon: CalendarClock },
    { id: "planejamento", count: data?.pacing.length, label: "Planejamentos a rever", icon: Route },
    {
      id: "atendimentos",
      count: data ? data.appointments.length + data.visits.length : undefined,
      label: "Seus atendimentos",
      icon: UsersRound,
    },
  ];
  return (
    <nav className={styles.overview} aria-label="Resumo das suas pendências">
      {items.map(({ id, count, label, icon: Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={(event) => {
            event.preventDefault();
            const section = document.querySelector<HTMLElement>(`#${id}`);
            section?.scrollIntoView({ block: "start", behavior: "instant" });
            section?.focus({ preventScroll: true });
          }}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
          <strong>
            {(id === "registros" ? lessonsPending : !data) ? (
              <span role="status" aria-label={`Carregando ${label.toLocaleLowerCase("pt-BR")}`}>
                <InlineSkeleton className="h-3 w-3 rounded-sm" />
              </span>
            ) : (
              (count ?? "—")
            )}
          </strong>
        </a>
      ))}
    </nav>
  );
}
