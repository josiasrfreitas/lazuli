"use client";

import type { ReactElement } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { gradeAverage } from "~/features/assessments/grade-average";
import { gradeLabel } from "~/features/assessments/shared";
import styles from "./class-page.module.css";

export function ClassGradeAverage({ classId }: { classId: string }): ReactElement {
  const query = trpc.assessments.class.useQuery({ classId });
  const grades = query.data?.flatMap((assessment) => assessment.grades) ?? [];
  let content: ReactElement;
  if (query.isPending) {
    content = (
      <div role="status">
        <InlineSkeleton className="h-8 w-24" />
        <span className="sr-only">Carregando média da turma</span>
      </div>
    );
  } else if (query.isError) {
    content = (
      <>
        <p className="text-caption text-muted-foreground">Média indisponível</p>
        <Button variant="link" size="inline" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </>
    );
  } else {
    content = (
      <>
        <p className={styles.occupancyValue}>
          {gradeLabel(gradeAverage(grades))} <span>/ 100</span>
        </p>
        <p
          className="text-caption text-muted-foreground"
          title="Média aritmética das notas lançadas nos estágios atuais dos alunos com vínculo vigente, incluindo recuperação. Notas não lançadas ficam fora do cálculo."
        >
          {grades.length > 0
            ? `${grades.length} ${grades.length === 1 ? "nota lançada" : "notas lançadas"}`
            : "Sem notas lançadas"}
        </p>
      </>
    );
  }
  return (
    <section className={styles.occupancy} aria-label="Média da turma">
      <h2 className="flex items-center gap-2 text-caption text-muted-foreground">
        <ChartNoAxesCombined aria-hidden="true" className="size-4" />
        Média da turma
      </h2>
      {content}
    </section>
  );
}
