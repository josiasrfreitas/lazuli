import type { ReactElement } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@lazuli/ui";
import { useStudentPedagogy, type StudentProfile } from "./logic";
import { StudentContactSummary } from "./student-identity";
import { ProfileLoading, ProfileError } from "./profile-shared";
import { StudentAcademicProgress } from "~/features/assessments/student-progress";
import { StudentFollowUp } from "~/features/pedagogical-follow-up/student-follow-up";
import { EnrollmentHistory } from "./student-history";
import { StudentAppointments } from "~/features/appointments/student-section";
import { CurrentEnrollment } from "./current-enrollment";

export function StudentPedagogySection({ profile }: { profile: StudentProfile }): ReactElement {
  const id = profile.id;
  const query = useStudentPedagogy(id);
  if (query.isPending) return <ProfileLoading />;
  if (query.isError)
    return (
      <ProfileError
        message="Não foi possível carregar o acompanhamento pedagógico."
        onRetry={() => void query.refetch()}
      />
    );
  const current = query.data.enrollments.filter((enrollment) => enrollment.current);
  const history = query.data.enrollments.filter((enrollment) => !enrollment.current);
  return (
    <div className="grid min-w-0 gap-6">
      {current.length > 0 ? (
        current.map((enrollment) => (
          <CurrentEnrollment
            key={enrollment.id}
            enrollment={enrollment}
            today={query.data.today}
            profile={profile}
          />
        ))
      ) : (
        <div className="grid gap-3">
          <NoCurrentEnrollment />
          <StudentContactSummary profile={profile} />
        </div>
      )}
      <StudentAcademicProgress studentId={id} />
      <div className="grid min-w-0 border border-border bg-accent xl:grid-cols-2">
        <StudentAppointments studentId={id} />
        <StudentFollowUp studentId={id} />
      </div>
      <EnrollmentHistory rows={history} today={query.data.today} />
    </div>
  );
}

function NoCurrentEnrollment(): ReactElement {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border border-border bg-accent p-5">
      <div className="flex items-start gap-3">
        <BookOpen aria-hidden="true" className="mt-1 size-5 shrink-0 text-icon" />
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-heading">Sem matrícula vigente</h2>
          <p className="text-sm text-muted-foreground">
            As matrículas anteriores e futuras aparecem no histórico abaixo.
          </p>
        </div>
      </div>
      <Button
        nativeButton={false}
        variant="secondary"
        size="compact-responsive"
        render={<Link href="/turmas" />}
      >
        Ver turmas
      </Button>
    </section>
  );
}
