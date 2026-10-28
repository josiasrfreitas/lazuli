import type { ReactElement, ReactNode } from "react";
import { GraduationCap, CalendarDays } from "lucide-react";
import { formatDateOnlyBR } from "~/lib/format";
import { useStudentPedagogy, type StudentProfile, type StudentEnrollment } from "./logic";
import { ProfileError } from "./profile-shared";
import { StudentFollowUp } from "~/features/pedagogical-follow-up/student-follow-up";
import { EnrollmentLoading } from "./student-loading";
import { EnrollmentHistory } from "./student-history";
import { CurrentEnrollment } from "./current-enrollment";
import { ContractTerminationNotice } from "./contract-termination-notice";
import { OrganizationIntention } from "./organization-intention";
import type { RouterOutputs } from "@lazuli/api";

type PedagogyProps = {
  profile: StudentProfile;
  pedagogyWorkspacePreview?: ReactNode;
  latestTermination?: RouterOutputs["finance"]["studentSummary"]["latestTermination"] | undefined;
};

export function StudentPedagogySection(props: PedagogyProps): ReactElement {
  const { profile, pedagogyWorkspacePreview } = props;
  const id = profile.id;
  const query = useStudentPedagogy(id);
  if (query.isPending) return <PedagogyLoadingState />;
  if (query.isError) return <PedagogyError onRetry={() => void query.refetch()} />;
  const current = query.data.enrollments.filter((enrollment) => enrollment.current);
  const history = query.data.enrollments.filter((enrollment) => !enrollment.current);
  if (current.length === 0)
    return (
      <NoCurrentPedagogy
        profile={profile}
        history={history}
        today={query.data.today}
        latestTermination={props.latestTermination}
      />
    );
  return (
    <div className="grid min-w-0 gap-6">
      <ContractTerminationNotice termination={props.latestTermination} studentId={id} />
      <OrganizationIntention studentId={id} />
      {current.map((enrollment) => (
        <CurrentEnrollment
          key={enrollment.id}
          enrollment={enrollment}
          today={query.data.today}
          profile={profile}
        />
      ))}
      {pedagogyWorkspacePreview ?? (
        <StudentFollowUp
          studentId={id}
          studentName={profile.contact.fullName}
          canRecord
          showAppointments={false}
        />
      )}
      <EnrollmentHistory
        rows={history}
        today={query.data.today}
        studentId={id}
        studentName={profile.contact.fullName}
      />
    </div>
  );
}

function PedagogyError({ onRetry }: { onRetry: () => void }): ReactElement {
  return (
    <ProfileError
      message="Não foi possível carregar o acompanhamento pedagógico."
      onRetry={onRetry}
    />
  );
}

function PedagogyLoadingState(): ReactElement {
  return (
    <div className="grid min-w-0 gap-6">
      <EnrollmentLoading />
    </div>
  );
}

function NoCurrentPedagogy({
  profile,
  history,
  today,
  latestTermination,
}: {
  profile: StudentProfile;
  history: StudentEnrollment[];
  today: string;
  latestTermination: PedagogyProps["latestTermination"];
}): ReactElement {
  const upcoming = history
    .filter((row) => row.entryDate > today)
    .toSorted((left, right) => left.entryDate.localeCompare(right.entryDate))[0];
  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <ContractTerminationNotice termination={latestTermination} studentId={profile.id} />
      <NoCurrentEnrollment
        upcoming={upcoming}
        hasHistory={history.some((row) => row.entryDate <= today)}
      />
      <StudentFollowUp
        studentId={profile.id}
        studentName={profile.contact.fullName}
        canRecord={false}
        showAppointments={false}
      />
      <EnrollmentHistory
        rows={history}
        today={today}
        studentId={profile.id}
        studentName={profile.contact.fullName}
      />
    </div>
  );
}

function NoCurrentEnrollment({
  upcoming,
  hasHistory,
}: {
  upcoming?: StudentEnrollment | undefined;
  hasHistory: boolean;
}): ReactElement {
  const Icon = upcoming ? CalendarDays : GraduationCap;
  let title = "O acompanhamento começa com a matrícula";
  let description =
    "Este aluno ainda não tem matrícula em uma turma. Quando ela estiver vigente, as aulas, as avaliações e os registros pedagógicos terão seu lugar aqui.";
  if (upcoming) {
    title = "O próximo período já tem data";
    description = `A matrícula na turma ${upcoming.class.name} começa em ${formatDateOnlyBR(upcoming.entryDate)}. A partir dessa data, você poderá acompanhar as aulas e registrar os atendimentos do aluno.`;
  } else if (hasHistory) {
    title = "Nenhuma matrícula em andamento";
    description =
      "Este aluno está sem matrícula vigente. O histórico continua disponível abaixo; novos registros ficam disponíveis quando uma nova matrícula começar.";
  }
  return (
    <section
      aria-labelledby="enrollment-empty-title"
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <Icon aria-hidden="true" className="mb-2 size-12 text-icon" strokeWidth={1.5} />
      <h2 id="enrollment-empty-title" className="font-display text-2xl font-semibold text-heading">
        {title}
      </h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
    </section>
  );
}
