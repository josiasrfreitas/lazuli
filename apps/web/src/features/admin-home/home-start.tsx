import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, Users, UserRoundPlus, GraduationCap } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { HomeData } from "./home-parts";
import type { BusinessData } from "./home-metrics";
import styles from "./home.module.css";

function hasSchoolActivity(data: HomeData): boolean {
  return (
    data.school.totalStudents !== 0 ||
    data.groups.some((group) => group.total !== 0 || Boolean(group.historyTotal)) ||
    data.agenda.total !== 0 ||
    data.school.students.series.some((row) => row.value !== 0) ||
    data.school.enrollments.series.some((row) => row.value !== 0) ||
    data.school.trials.series.some((row) => row.value !== 0)
  );
}
function hasBusinessActivity(business: BusinessData): boolean {
  return (
    business.overdueCents !== 0 ||
    business.agreements.series.some((row) => row.value !== 0) ||
    business.months.some((row) => row.receivedCents !== 0 || row.expectedCents !== 0)
  );
}
export function isSchoolStarting({
  data,
  business,
  finance,
}: {
  data: HomeData | undefined;
  business: BusinessData | undefined;
  finance: boolean;
}): boolean {
  if (!data || hasSchoolActivity(data)) return false;
  return !finance || Boolean(business && !hasBusinessActivity(business));
}
export function HomeStart(): ReactElement {
  return (
    <section className={styles.startPanel}>
      <div className={styles.startIntro}>
        <h2>Vamos dar vida à sua escola.</h2>
        <p>Cadastre o primeiro aluno. Você pode definir a turma e preparar o contrato depois.</p>
        <Button nativeButton={false} render={<Link href="/alunos" />}>
          Começar pelos alunos
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
      <div className={styles.startPaths}>
        <Link href="/alunos">
          <Users aria-hidden="true" />
          <div>
            <h3>Alunos</h3>
            <p>Cadastros, matrículas e acompanhamento dos estudos.</p>
          </div>
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link href="/interessados">
          <UserRoundPlus aria-hidden="true" />
          <div>
            <h3>Quem quer estudar aqui</h3>
            <p>Leads, nivelamentos e aulas experimentais.</p>
          </div>
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link href="/organizacao">
          <GraduationCap aria-hidden="true" />
          <div>
            <h3>Organização das turmas</h3>
            <p>Prepare os horários e a entrada dos alunos nas turmas.</p>
          </div>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
