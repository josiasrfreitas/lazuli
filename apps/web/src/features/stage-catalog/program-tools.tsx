import type { ReactNode } from "react";
import {
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@lazuli/ui";
import type { TeachingProgram } from "./types";
import styles from "./catalog.module.css";
const MINUTES_PER_HOUR = 60;
const programLabel = (program: TeachingProgram): string =>
  `${program.scheduleType === "REGULAR" ? "Regular" : "PPT"} · ${program.teachingHourCount}h`;

type ProgramChoiceProps = {
  programs: TeachingProgram[];
  program: TeachingProgram;
  onProgram: (id: string) => void;
};
export function ProgramTools({
  programs,
  program,
  onProgram,
  filter,
  onFilter,
}: ProgramChoiceProps & { filter: string; onFilter: (value: string) => void }): ReactNode {
  return (
    <div className={styles.programTools}>
      <div className={styles.programChoice}>
        <ProgramChoice programs={programs} program={program} onProgram={onProgram} />
        <span>{program.modality.weeklyMinutes / MINUTES_PER_HOUR}h por semana</span>
      </div>
      <SegmentedControl
        size="sm"
        value={filter}
        onValueChange={(value) => {
          if (value) onFilter(value);
        }}
        aria-label="Conteúdo da programação"
      >
        <SegmentedControlItem value="all">Tudo</SegmentedControlItem>
        <SegmentedControlItem value="assessments">Provas</SegmentedControlItem>
      </SegmentedControl>
    </div>
  );
}

function ProgramChoice({ programs, program, onProgram }: ProgramChoiceProps): ReactNode {
  if (programs.length <= 2)
    return (
      <SegmentedControl
        size="sm"
        value={program.id}
        onValueChange={(value) => {
          if (value) onProgram(value);
        }}
        aria-label="Programação do estágio"
      >
        {programs.map((entry) => (
          <SegmentedControlItem key={entry.id} value={entry.id}>
            {programLabel(entry)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    );
  return (
    <Select
      value={program.id}
      onValueChange={(value) => {
        if (value) onProgram(value);
      }}
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
  );
}
