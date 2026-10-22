"use client";

import type { ReactElement } from "react";
import { ArrowRight, BookOpenCheck, CalendarClock, CheckCheck } from "lucide-react";
import { Button } from "@lazuli/ui";
import { purposes } from "~/features/appointments/shared";
import {
  HomeEmpty,
  HomeList,
  HomeRow,
  HomeSection,
  homeDate,
  relativeHomeDate,
  type HomeData,
  type PendingLesson,
} from "./home-parts";
import styles from "./home.module.css";

export function LessonSection({
  lessons,
  open,
  celebrate,
}: {
  lessons: PendingLesson[];
  open: (id: string) => void;
  celebrate: boolean;
}): ReactElement {
  const first = lessons[0];
  return (
    <HomeSection id="registros" title="Aulas por registrar" count={lessons.length}>
      {first ? (
        <>
          <NextLesson lesson={first} open={open} />
          <HomeList
            items={lessons.slice(1)}
            label="as outras aulas"
            limit={1}
            render={(row) => (
              <HomeRow
                title={row.className}
                description={`${homeDate(row.date)} · ${row.startTime}–${row.endTime}`}
                onClick={() => open(row.id)}
              />
            )}
          />
        </>
      ) : (
        <div className={styles.caughtUp}>
          <BookOpenCheck
            aria-hidden="true"
            className={celebrate ? styles.settledBook : undefined}
          />
          <div>
            <strong>Diário em dia. Pode respirar.</strong>
            <p>O que aconteceu em aula já tem seu lugar aqui.</p>
          </div>
        </div>
      )}
    </HomeSection>
  );
}

function NextLesson({
  lesson,
  open,
}: {
  lesson: PendingLesson;
  open: (id: string) => void;
}): ReactElement {
  return (
    <div className={styles.nextTask}>
      <div className={styles.taskHeading}>
        <BookOpenCheck aria-hidden="true" />
        <div>
          <strong>{lesson.className}</strong>
          <p>
            {homeDate(lesson.date)} · {lesson.startTime}–{lesson.endTime}
          </p>
        </div>
      </div>
      <div className={styles.taskAction}>
        <span>A presença e a história desta aula.</span>
        <Button size="compact-responsive" onClick={() => open(lesson.id)}>
          Registrar aula
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function AssessmentSection({
  data,
  openGrades,
  openAppointment,
}: {
  data: HomeData;
  openGrades: (id: string) => void;
  openAppointment: (id: string) => void;
}): ReactElement {
  const appointments = data.assessmentAppointments;
  const count = data.assessments.length + appointments.length;
  return (
    <HomeSection
      id="avaliacoes"
      title="Avaliações por fazer"
      count={count}
      description="Encontros de avaliação e notas por completar."
    >
      {appointments.length > 0 && (
        <HomeAppointmentList items={appointments} today={data.today} open={openAppointment} />
      )}
      <HomeList
        items={data.assessments.map((row) => ({ ...row, id: row.progressId }))}
        label="os alunos"
        limit={appointments.length > 0 ? 1 : 2}
        render={(row) => (
          <HomeRow
            title={row.studentName}
            description={`${row.className} · ${row.stageName}`}
            onClick={() => openGrades(row.progressId)}
          >
            <span className={styles.rowDetail}>
              {row.missingGrades} {row.missingGrades === 1 ? "nota por lançar" : "notas por lançar"}
            </span>
          </HomeRow>
        )}
      />
      {!count && (
        <HomeEmpty detail="As notas estão completas e não há encontros de avaliação neste período.">
          Avaliações em dia.
        </HomeEmpty>
      )}
    </HomeSection>
  );
}

export function ExamsSection({ data }: { data: HomeData }): ReactElement {
  return (
    <HomeSection
      id="provas"
      title="Provas chegando"
      count={data.exams.length}
      description={`Previstas nos próximos ${data.windowDays} dias.`}
    >
      <HomeList
        items={data.exams}
        label="as provas"
        render={(row) => (
          <HomeRow
            href={row.href}
            title={row.title}
            description={`${row.className}${row.studentName ? ` · ${row.studentName}` : ""}`}
          >
            <span className={styles.dateNote}>
              <CalendarClock aria-hidden="true" />
              {relativeHomeDate(row.date, data.today)} · Consultar planejamento
            </span>
          </HomeRow>
        )}
      />
      {data.exams.length === 0 && (
        <p className={styles.quiet}>
          Nenhuma prova prevista para os próximos {data.windowDays} dias.
        </p>
      )}
      {data.unconfiguredPlans > 0 && (
        <p className={styles.footnote}>
          {data.unconfiguredPlans}{" "}
          {data.unconfiguredPlans === 1
            ? "planejamento ainda não foi definido"
            : "planejamentos ainda não foram definidos"}
          .
        </p>
      )}
    </HomeSection>
  );
}

export function PacingSection({ data }: { data: HomeData }): ReactElement {
  return (
    <HomeSection id="planejamento" title="De olho no planejamento" count={data.pacing.length}>
      <HomeList
        items={data.pacing}
        label="os pontos de atenção"
        render={(row) => <PacingRow row={row} />}
      />
      {data.pacing.length > 0 ? (
        <p className={styles.footnote}>
          Conteúdo previsto há {data.windowDays} dias ou mais. Nas etapas, a comparação respeita a
          faixa de um encontro antes e um depois. Confira o diário antes de ajustar o plano.
        </p>
      ) : (
        <HomeEmpty detail="Comparação feita onde há etapas vinculadas ou páginas registradas no mesmo material.">
          Sem distâncias sinalizadas.
        </HomeEmpty>
      )}
    </HomeSection>
  );
}

function PacingRow({ row }: { row: HomeData["pacing"][number] }): ReactElement {
  return (
    <HomeRow
      href={row.href}
      title={row.studentName ? `${row.className} · ${row.studentName}` : row.className}
      description={
        row.basis === "STEP"
          ? `Etapa prevista: ${row.reference}`
          : (row.reference ?? "Avanço no material")
      }
    >
      <span className={styles.pageComparison}>
        <span>
          Registrado{" "}
          <strong>
            {row.basis === "STEP" ? "etapa" : "p."} {row.actual}
          </strong>
        </span>
        <ArrowRight aria-hidden="true" />
        <span>
          Previsto{" "}
          <strong>
            {row.basis === "STEP" ? "etapa" : "p."} {row.expected}
          </strong>
        </span>
      </span>
      <span className={styles.rowDetail}>
        Previsto até {homeDate(row.plannedOn)} · Último registro em {homeDate(row.lastRecordedOn)}
      </span>
    </HomeRow>
  );
}

export function AppointmentsSection({
  data,
  open,
  openVisit,
}: {
  data: HomeData;
  open: (id: string) => void;
  openVisit: (id: string) => void;
}): ReactElement {
  return (
    <HomeSection
      id="atendimentos"
      title="Seus atendimentos"
      count={data.appointments.length + data.visits.length}
      description={`Próximos ${data.windowDays} dias e registros pendentes.`}
    >
      <HomeAppointmentList items={data.appointments} today={data.today} open={open} />
      <HomeList
        items={data.visits}
        label="os nivelamentos e experimentais"
        render={(row) => (
          <HomeRow
            title={row.studentName}
            description={`${row.kind === "PLACEMENT" ? "Nivelamento" : "Aula experimental"} · ${relativeHomeDate(row.date, data.today)} · ${row.startTime}`}
            onClick={() => openVisit(row.id)}
          >
            {row.correctionPending && <span className={styles.attention}>Prova por corrigir</span>}
          </HomeRow>
        )}
      />
      {data.appointments.length + data.visits.length === 0 && (
        <p className={styles.quiet}>
          Nenhum atendimento, nivelamento ou experimental neste período.
        </p>
      )}
    </HomeSection>
  );
}

function HomeAppointmentList({
  items,
  today,
  open,
}: {
  items: HomeData["appointments"];
  today: string;
  open: (id: string) => void;
}): ReactElement {
  return (
    <HomeList
      items={items}
      label="os encontros"
      render={(row) => (
        <HomeRow
          id={`appointment-cell-${row.id}`}
          title={row.studentName}
          description={`${purposes[row.purpose]} · ${relativeHomeDate(row.date, today)} · ${row.startTime}`}
          onClick={() => open(row.id)}
        >
          {row.overdue && (
            <span className={styles.attention}>
              {row.date < today
                ? "Registro pendente · consultar coordenação"
                : "Já pode registrar o encontro"}
            </span>
          )}
        </HomeRow>
      )}
    />
  );
}

export function HomeSignoff(): ReactElement {
  return (
    <p className={styles.signoff}>
      <CheckCheck aria-hidden="true" />
      Um cuidado de cada vez. Cada aula conta.
    </p>
  );
}
