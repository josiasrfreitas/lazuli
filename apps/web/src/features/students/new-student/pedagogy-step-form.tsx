import type { FormEvent, JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { normalizeSearch } from "@lazuli/domain";
import { ToastAlert } from "@lazuli/ui";
import type { QueryResult } from "~/lib/trpc";
import { NarrativeField } from "~/features/shared/task-form";
import type { PedagogyDraft } from "./pedagogy-step";
import { pedagogyIntake } from "./pedagogy-step";
import { PedagogyEntryFields, PedagogyStageField } from "./pedagogy-step-fields";
import type { PedagogySemester } from "./use-pedagogy-semester";

type OptionsQuery = QueryResult<RouterOutputs["classes"]["formOptions"]>;
type FormProps = {
  draft: PedagogyDraft;
  semester: PedagogySemester;
  options: OptionsQuery;
  error: string;
  semesterError: string;
  stageQuery: string;
  set: (patch: Partial<PedagogyDraft>) => void;
  setError: (value: string) => void;
  setSemesterError: (value: string) => void;
  setStageQuery: (value: string) => void;
  onSubmit: () => void;
};

export function PedagogyStepForm(props: FormProps): ReactJSX.Element {
  const { draft, semester, options, error, set, setError, setSemesterError, onSubmit } = props;
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    try {
      if (!draft.semesterId || ![semester.currentId, semester.nextId].includes(draft.semesterId)) {
        setSemesterError("Escolha o período atual ou o próximo período de entrada.");
        return;
      }
      pedagogyIntake(draft);
      onSubmit();
    } catch {
      setError("Revise o semestre e o estágio informados.");
    }
  };
  return (
    <form id="new-student-pedagogico" noValidate className="grid gap-4" onSubmit={handleSubmit}>
      {(error || semester.periods.error || options.error) && (
        <ToastAlert variant="warning">
          {error || semester.periods.error?.message || options.error?.message}
        </ToastAlert>
      )}
      <PedagogyStepEntry {...props} />
      <NarrativeField
        name="intake-notes"
        label="Preferências e combinados · opcional"
        placeholder="Preferências de horário para a entrada"
        rows={2}
        value={draft.notes}
        onChange={(notes) => set({ notes })}
      />
      <p className="text-caption text-muted-foreground">
        Sem turma definida, o aluno fica na fila de encaixe do período escolhido.
      </p>
    </form>
  );
}

function PedagogyStepEntry(props: FormProps): ReactJSX.Element {
  const { draft, semester, semesterError, set, setSemesterError } = props;
  return (
    <PedagogyEntryFields
      current={semester.current}
      next={semester.next}
      semesterId={draft.semesterId}
      semesterError={semesterError}
      periodsPending={semester.periods.isPending}
      periodsFailed={Boolean(semester.periods.error)}
      onSemesterChange={(semesterId) => {
        set({ semesterId });
        setSemesterError("");
      }}
      stage={<StageSelection {...props} />}
    />
  );
}

function StageSelection({
  draft,
  options,
  stageQuery,
  set,
  setStageQuery,
}: FormProps): ReactJSX.Element {
  const stages = (options.data?.stages ?? []).map((stage) => ({
    id: stage.id,
    label: `${stage.internalCode} · ${stage.name}`,
  }));
  const selected = stages.find((stage) => stage.id === draft.stageId) ?? null;
  const matches = stages.filter((stage) =>
    normalizeSearch(stage.label).includes(normalizeSearch(stageQuery)),
  );
  return (
    <PedagogyStageField
      pending={options.isPending}
      failed={Boolean(options.error)}
      query={stageQuery}
      selected={selected}
      hasStage={Boolean(draft.stageId)}
      matches={matches}
      onQueryChange={setStageQuery}
      onSelect={(stageId) => {
        set({ stageId });
        setStageQuery("");
      }}
      onClear={() => {
        set({ stageId: "" });
        setStageQuery("");
      }}
    />
  );
}
