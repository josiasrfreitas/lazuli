"use client";
import { useState, type ReactNode } from "react";
import { Button, EmptyState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ProgramMap } from "./program-map";
import { ProgramLoading } from "./loading";
import { TrackName } from "./track-name";
import { ProgramTools } from "./program-tools";
import type { StageSummary, TeachingProgram } from "./types";
import styles from "./catalog.module.css";

export function StagePrograms({ stage }: { stage: StageSummary }): ReactNode {
  const query = trpc.teachingPrograms.detail.useQuery({ id: stage.id });
  const [programId, setProgramId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const programs = query.data?.programs ?? [];
  const program =
    programs.find((entry) => entry.id === programId) ??
    programs.find((entry) => entry.scheduleType === "REGULAR") ??
    programs[0];
  return (
    <section className={styles.detail} aria-label={`Programação de ${stage.name}`}>
      <header className={styles.detailHeader}>
        <div className={styles.identity}>
          <div className={styles.stageTitle}>
            <h2>{stage.name}</h2>
            <span>{stage.internalCode}</span>
          </div>
          <p>
            <TrackName track={stage.track} /> ·{" "}
            {stage.track.ageGroup === "CHILD" ? "Infantil" : "Adulto"}
          </p>
        </div>
        {program && (
          <ProgramTools
            programs={programs}
            program={program}
            onProgram={setProgramId}
            filter={filter}
            onFilter={setFilter}
          />
        )}
      </header>
      <div className={styles.detailBody}>
        <ProgramBody
          pending={query.isPending}
          failed={query.isError}
          onRetry={() => void query.refetch()}
          program={program}
          filter={filter}
        />
      </div>
      {program && <ProgramSource program={program} />}
    </section>
  );
}

function ProgramBody({
  pending,
  failed,
  onRetry,
  program,
  filter,
}: {
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
  program: TeachingProgram | undefined;
  filter: string;
}): ReactNode {
  if (pending) return <ProgramLoading />;
  if (failed)
    return (
      <EmptyState
        title="Não foi possível abrir a programação"
        description="Tente carregar os dados novamente."
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        }
      />
    );
  if (program)
    return (
      <ProgramMap
        key={`${program.id}-${filter}`}
        program={program}
        onlyAssessments={filter === "assessments"}
      />
    );
  return (
    <EmptyState
      title="Programação ainda não importada"
      description="As unidades, lições e provas deste estágio aparecerão aqui após a importação da fonte."
    />
  );
}

function ProgramSource({ program }: { program: TeachingProgram }): ReactNode {
  return (
    <footer className={styles.source}>
      Fonte: {program.source.reference} · revisão {program.source.revision}
      {program.unresolvedActivityCount > 0 && (
        <span> · Há atividades aguardando descrição na fonte.</span>
      )}
    </footer>
  );
}
