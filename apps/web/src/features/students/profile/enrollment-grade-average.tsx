import type { ReactElement } from "react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { gradeAverage } from "~/features/assessments/grade-average";
import { gradeLabel } from "~/features/assessments/shared";
import { MetricHeading } from "./metric-heading";

export function EnrollmentGradeAverage({ progressId }: { progressId?: string }): ReactElement {
  const query = trpc.assessments.byProgress.useQuery(
    { progressId: progressId ?? "" },
    { enabled: Boolean(progressId) },
  );
  return (
    <section
      aria-label="Média geral do estágio atual"
      className="grid min-w-0 content-start gap-2 border-l border-border/60 pl-4 sm:pl-5"
    >
      <MetricHeading label="Média geral">
        Média aritmética de todas as notas lançadas no estágio atual, incluindo recuperação. Notas
        ainda não lançadas ficam fora do cálculo.
      </MetricHeading>
      {progressId && query.isPending ? (
        <div role="status">
          <InlineSkeleton className="h-10 w-24" />
          <span className="sr-only">Carregando média</span>
        </div>
      ) : query.isError ? (
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Média indisponível</p>
          <Button variant="link" size="compact-responsive" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <GradeAverageReading grades={query.data?.grades ?? []} />
      )}
    </section>
  );
}

function GradeAverageReading({ grades }: { grades: readonly { score: number }[] }): ReactElement {
  return (
    <>
      <p className="font-numeric text-4xl font-semibold leading-none tracking-tight tabular-nums text-heading">
        {gradeLabel(gradeAverage(grades))}
      </p>
      <p className="text-caption text-muted-foreground">
        {grades.length ? `${grades.length} notas · estágio atual` : "Sem notas lançadas"}
      </p>
      <p className="text-caption text-muted-foreground">de 100 pontos possíveis</p>
    </>
  );
}
