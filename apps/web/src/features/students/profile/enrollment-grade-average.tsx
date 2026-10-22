import type { ReactElement } from "react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { gradeAverage } from "~/features/assessments/grade-average";
import { gradeLabel } from "~/features/assessments/shared";
import { StudentAssessmentsDialog } from "./student-assessments-dialog";
import { MetricHeading } from "./metric-heading";

export function EnrollmentGradeAverage({
  progressId,
  studentId,
  studentName,
}: {
  progressId?: string | undefined;
  studentId: string;
  studentName: string;
}): ReactElement {
  const query = trpc.assessments.byProgress.useQuery(
    { progressId: progressId ?? "" },
    { enabled: Boolean(progressId) },
  );
  return (
    <section
      aria-label="Média geral do estágio atual"
      className="flex min-w-0 flex-col gap-2 border-l border-border/60 pl-4 sm:pl-5"
    >
      <MetricHeading label="Média geral">
        Média aritmética de todas as notas lançadas no estágio atual, incluindo recuperação. Notas
        ainda não lançadas ficam fora do cálculo.
      </MetricHeading>
      <GradeAverageContent
        pending={Boolean(progressId) && query.isPending}
        error={query.isError}
        grades={query.data?.grades ?? []}
        retry={() => void query.refetch()}
      />
      <div className="mt-auto pt-1">
        <StudentAssessmentsDialog
          studentId={studentId}
          studentName={studentName}
          progressId={progressId}
        />
      </div>
    </section>
  );
}

function GradeAverageContent({
  pending,
  error,
  grades,
  retry,
}: {
  pending: boolean;
  error: boolean;
  grades: readonly { score: number }[];
  retry: () => void;
}): ReactElement {
  if (pending)
    return (
      <div role="status">
        <InlineSkeleton className="h-10 w-24" />
        <span className="sr-only">Carregando média</span>
      </div>
    );
  if (error)
    return (
      <div className="grid gap-1">
        <p className="text-sm text-muted-foreground">Média indisponível</p>
        <Button variant="link" size="compact-responsive" onClick={retry}>
          Tentar novamente
        </Button>
      </div>
    );
  return <GradeAverageReading grades={grades} />;
}

function GradeAverageReading({ grades }: { grades: readonly { score: number }[] }): ReactElement {
  return (
    <>
      <p className="font-numeric text-4xl font-semibold leading-none tracking-tight tabular-nums text-heading">
        {gradeLabel(gradeAverage(grades))}
      </p>
      <p className="text-caption text-muted-foreground">
        {grades.length > 0 ? `${grades.length} notas · estágio atual` : "Sem notas lançadas"}
      </p>
      <p className="text-caption text-muted-foreground">de 100 pontos possíveis</p>
    </>
  );
}
