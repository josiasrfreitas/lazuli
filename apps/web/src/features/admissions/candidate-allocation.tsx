"use client";
import { useState, type ReactElement } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { TextControl } from "~/features/classes/form-controls";
import { dateLabel, type Candidate } from "./labels";
import { EnrollDialog } from "./enroll-dialog";
import { MatchingClasses } from "./matching-classes";

function useAllocation(candidate: Candidate) {
  const [date, setDate] = useState(dateLabel(candidate.today));
  const [selected, setSelected] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const parsed = parseDateBR(date);
  const enabled = Boolean(parsed && candidate.stageId);
  const query = trpc.admissions.matches.useQuery(
    { id: candidate.id, date: parsed ?? candidate.today },
    { enabled, retry: false },
  );
  const changeDate = (value: string): void => {
    setDate(maskDateBR(value));
    setSelected("");
  };
  return {
    date,
    parsed,
    selected,
    setSelected,
    enrolling,
    setEnrolling,
    enabled,
    query,
    changeDate,
    choice: query.data?.find((row) => row.id === selected),
  };
}
type Allocation = ReturnType<typeof useAllocation>;
export function CandidateAllocation({
  candidate,
  onEdit,
}: {
  candidate: Candidate;
  onEdit: () => void;
}): ReactElement {
  const allocation = useAllocation(candidate);
  return (
    <section
      className="grid gap-5 rounded-lg border border-border bg-card p-4 sm:p-5"
      aria-label="Encontrar turma"
    >
      <AllocationHeader allocation={allocation} />
      <AllocationResults candidate={candidate} allocation={allocation} onEdit={onEdit} />
      {allocation.enrolling && allocation.choice && allocation.parsed && (
        <EnrollDialog
          candidate={candidate}
          choice={allocation.choice}
          date={allocation.parsed}
          onClose={() => allocation.setEnrolling(false)}
        />
      )}
    </section>
  );
}
function AllocationHeader({ allocation }: { allocation: Allocation }): ReactElement {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid gap-1">
        <h2 className="font-display text-h3 font-semibold">Encontre a turma certa</h2>
        <p className="text-caption text-muted-foreground">Turmas do estágio e formato indicados.</p>
      </div>
      <div className="w-36">
        <TextControl
          name="allocation-date"
          label="Entrada a partir de"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          value={allocation.date}
          onChange={allocation.changeDate}
          error={allocation.date && !allocation.parsed ? "Data inválida." : undefined}
        />
      </div>
    </div>
  );
}
type AllocationResultsProps = {
  candidate: Candidate;
  allocation: Allocation;
  onEdit: () => void;
};
function AllocationResults({
  candidate,
  allocation,
  onEdit,
}: AllocationResultsProps): ReactElement {
  if (!candidate.stageId)
    return (
      <div className="grid justify-items-start gap-3 border-t border-border pt-4">
        <p className="text-caption text-muted-foreground">
          Registre o estágio indicado pelo nivelamento para encontrar turmas compatíveis.
        </p>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Informar estágio
        </Button>
      </div>
    );
  if (!allocation.enabled)
    return (
      <p className="text-caption text-muted-foreground">Informe uma data de entrada válida.</p>
    );
  if (allocation.query.isError)
    return <Alert variant="destructive">{allocation.query.error.message}</Alert>;
  if (!allocation.query.data) return <InlineSkeleton className="h-24 w-full" />;
  if (allocation.query.data.length === 0) return <NoMatchingClass />;
  return (
    <>
      <MatchingClasses
        rows={allocation.query.data}
        selected={allocation.selected}
        onSelect={allocation.setSelected}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-caption text-muted-foreground">
          Capacidade de referência. A matrícula não gera cobranças.
        </p>
        <Button
          size="compact-responsive"
          disabled={!allocation.choice || allocation.query.isFetching}
          onClick={() => allocation.setEnrolling(true)}
        >
          Matricular
          <ArrowRight />
        </Button>
      </div>
    </>
  );
}
function NoMatchingClass(): ReactElement {
  return (
    <div className="flex gap-3 border-t border-border py-5">
      <Search className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="grid gap-1">
        <p className="font-medium">Nenhuma turma compatível por enquanto</p>
        <p className="text-caption text-muted-foreground">
          O interesse continua registrado. Consulte novamente após a abertura de novas turmas.
        </p>
      </div>
    </div>
  );
}
