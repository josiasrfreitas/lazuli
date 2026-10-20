import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { useStudentPedagogy, type StudentEnrollment } from "./logic";
import { ProfileError } from "./profile-shared";
import { CurrentEnrollment } from "./current-enrollment";
import { EnrollmentHistory } from "./student-history";

export function StudentPedagogy({ id }: { id: string }): ReactElement {
  const query = useStudentPedagogy(id);
  if (query.isPending)
    return (
      <div role="status" className="grid gap-3">
        <InlineSkeleton className="h-6 w-48" />
        <InlineSkeleton className="h-20 w-full" />
        <span className="sr-only">Carregando matrículas e frequência</span>
      </div>
    );
  if (query.isError)
    return (
      <ProfileError
        message="Não foi possível carregar as matrículas."
        onRetry={() => void query.refetch()}
      />
    );
  const { today, enrollments } = query.data;
  const current = enrollments.filter((row) => row.current);
  const history = enrollments.filter((row) => !row.current);
  const upcoming = history.findLast((row) => row.entryDate > today);
  return (
    <div className="grid min-w-0 gap-6">
      <section className="grid min-w-0 gap-4" aria-labelledby="current-enrollments">
        <h2 id="current-enrollments" className="font-display text-xl font-semibold text-heading">
          Matrículas vigentes
        </h2>
        {current.map((enrollment) => (
          <CurrentEnrollment key={enrollment.id} enrollment={enrollment} today={today} />
        ))}
        {current.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            {emptyMessage(upcoming, history.length > 0)}
          </p>
        )}
      </section>
      <EnrollmentHistory rows={history} today={today} onRetry={() => void query.refetch()} />
    </div>
  );
}

function emptyMessage(upcoming: StudentEnrollment | undefined, hasHistory: boolean): string {
  if (upcoming)
    return `A próxima matrícula começa em ${formatDateOnlyBR(upcoming.entryDate)}, na turma ${upcoming.class.name}.`;
  return hasHistory
    ? "Nenhuma matrícula em andamento. O histórico continua disponível abaixo."
    : "Este aluno ainda não tem matrícula em uma turma.";
}
