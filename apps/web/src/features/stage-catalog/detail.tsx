"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import {
  Button,
  EmptyState,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ProgramMap } from "./program-map";
import { ProgramLoading } from "./loading";
import { TrackName } from "./track-name";
import type { StageSummary, TeachingProgram } from "./types";
import styles from "./catalog.module.css";

const mode = (program: TeachingProgram) => (program.scheduleType === "REGULAR" ? "Regular" : "PPT");
const programLabel = (program: TeachingProgram): string =>
  `${mode(program)} · ${program.teachingHourCount} horas-aula`;

export function StagePrograms({ stage }: { stage: StageSummary }): ReactJSX.Element {
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
          <div className={styles.programTools}>
            <div className={styles.programChoice}>
              {programs.length <= 2 ? (
                <SegmentedControl
                  size="sm"
                  value={program.id}
                  onValueChange={(value) => {
                    if (value) setProgramId(value);
                  }}
                  aria-label="Programação do estágio"
                >
                  {programs.map((entry) => (
                    <SegmentedControlItem key={entry.id} value={entry.id}>
                      {programLabel(entry)}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              ) : (
                <Select
                  value={program.id}
                  onValueChange={(value) => setProgramId(value)}
                  items={programs.map((entry) => ({
                    value: entry.id,
                    label: `${programLabel(entry)} · ${entry.modality.name}`,
                  }))}
                >
                  <SelectTrigger size="sm" aria-label="Programação do estágio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {programLabel(entry)} · {entry.modality.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <span>{program.modality.weeklyMinutes / 60}h por semana</span>
            </div>
            <SegmentedControl
              size="sm"
              value={filter}
              onValueChange={(value) => {
                if (value) setFilter(value);
              }}
              aria-label="Conteúdo da programação"
            >
              <SegmentedControlItem value="all">Tudo</SegmentedControlItem>
              <SegmentedControlItem value="assessments">Provas</SegmentedControlItem>
            </SegmentedControl>
          </div>
        )}
      </header>
      <div className={styles.detailBody}>
        {query.isPending ? (
          <ProgramLoading />
        ) : query.isError ? (
          <EmptyState
            title="Não foi possível abrir a programação"
            description="Tente carregar os dados novamente."
            action={
              <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        ) : program ? (
          <ProgramMap
            key={`${program.id}-${filter}`}
            program={program}
            onlyAssessments={filter === "assessments"}
          />
        ) : (
          <EmptyState
            title="Programação ainda não importada"
            description="As unidades, lições e provas deste estágio aparecerão aqui após a importação da fonte."
          />
        )}
      </div>
      {program && (
        <footer className={styles.source}>
          Fonte: {program.source.reference}
          {program.unresolvedActivityCount > 0 && (
            <span> · Há atividades aguardando descrição na fonte.</span>
          )}
        </footer>
      )}
    </section>
  );
}
