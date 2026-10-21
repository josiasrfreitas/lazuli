import { Pencil } from "lucide-react";
import type { ReactElement } from "react";
import {
  Button,
  InlineSkeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@lazuli/ui";
import {
  ASSESSMENT_ROW_ORDER,
  COMPETENCE_LABELS,
  gradeLabel,
  PASS,
  type Assessment,
  type Competence,
} from "./shared";
import styles from "./assessment-workspace.module.css";
type ResultsProps = {
  data?: Assessment;
  recovery?: boolean;
  onEdit?: (competence: Competence, trigger: HTMLButtonElement) => void;
};
type ResultRowProps = {
  data: Assessment | undefined;
  recovery: boolean;
  actions: boolean;
  competence: Competence;
  onEdit: ResultsProps["onEdit"];
};
export function AssessmentResults({ data, recovery = false, onEdit }: ResultsProps): ReactElement {
  const actions = !data || Boolean(onEdit);
  return (
    <TableContainer>
      <Table
        aria-label={recovery ? "Notas de recuperação" : "Notas por unidade"}
        density="dense"
        className="min-w-0 table-fixed"
        aria-busy={!data || undefined}
      >
        <colgroup>
          <col className="w-22" />
          <col />
          {!recovery && <col />}
          <col />
          {actions && <col className="w-10" />}
        </colgroup>
        <ResultsHeader recovery={recovery} actions={actions} />
        <TableBody>
          {ASSESSMENT_ROW_ORDER.map((competence) => (
            <ResultRow
              key={competence}
              data={data}
              recovery={recovery}
              actions={actions}
              competence={competence}
              onEdit={onEdit}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
function ResultsHeader({
  recovery,
  actions,
}: {
  recovery: boolean;
  actions: boolean;
}): ReactElement {
  return (
    <TableHeader>
      <TableRow interactive={false}>
        <TableHead>Avaliação</TableHead>
        {recovery ? (
          <TableHead numeric className="px-1 sm:px-1.5">
            Nota
          </TableHead>
        ) : (
          <>
            <TableHead numeric className="px-1 sm:px-1.5" aria-label="Unidade 1">
              <span className="sm:hidden">U1</span>
              <span className="hidden sm:inline">Unid. 1</span>
            </TableHead>
            <TableHead numeric className="px-1 sm:px-1.5" aria-label="Unidade 2">
              <span className="sm:hidden">U2</span>
              <span className="hidden sm:inline">Unid. 2</span>
            </TableHead>
          </>
        )}
        <TableHead numeric className="px-1 sm:px-1.5" aria-label={recovery ? "Final" : "Média"}>
          {recovery ? (
            "Final"
          ) : (
            <>
              <span className="sm:hidden">Méd.</span>
              <span className="hidden sm:inline">Média</span>
            </>
          )}
        </TableHead>
        {actions && (
          <TableHead className="px-1">
            <span className="sr-only">Editar avaliação</span>
          </TableHead>
        )}
      </TableRow>
    </TableHeader>
  );
}
function resultValues(
  result: Assessment["results"][number] | undefined,
  recovery: boolean,
): { value: number | null; scores: (number | null)[] } {
  if (!result) return { value: null, scores: Array.from({ length: recovery ? 1 : 2 }, () => null) };
  return {
    value: recovery ? result.effective : result.average,
    scores: recovery ? [result.recovery] : [result.blockOne, result.blockTwo],
  };
}
function ResultRow({ data, recovery, competence, actions, onEdit }: ResultRowProps): ReactElement {
  const result = data?.results.find((row) => row.competence === competence);
  const { value, scores } = resultValues(result, recovery);
  return (
    <TableRow interactive={false}>
      <TableCell className="whitespace-nowrap">{COMPETENCE_LABELS[competence]}</TableCell>
      {scores.map((score, index) => (
        <TableCell key={index} numeric className="px-1 sm:px-1.5">
          {result ? gradeLabel(score) : <GradeSkeleton />}
        </TableCell>
      ))}
      <TableCell numeric className="px-1 sm:px-1.5">
        {result ? (
          <span className={resultClass(value)}>{gradeLabel(value)}</span>
        ) : (
          <GradeSkeleton />
        )}
      </TableCell>
      {actions && (
        <TableCell className="px-1">
          <ResultAction competence={competence} recovery={recovery} onEdit={onEdit} />
        </TableCell>
      )}
    </TableRow>
  );
}
function resultClass(value: number | null): string | undefined {
  if (value === null) return styles.muted;
  return value >= PASS ? styles.passed : styles.below;
}
function GradeSkeleton(): ReactElement {
  return <InlineSkeleton className="h-3 w-5 max-w-full rounded-sm" />;
}
function ResultAction({
  competence,
  recovery,
  onEdit,
}: Pick<ResultRowProps, "competence" | "recovery" | "onEdit">): ReactElement {
  if (!onEdit) return <InlineSkeleton className="size-8 rounded-sm" />;
  return (
    <Button
      size="icon-sm"
      variant="secondary"
      aria-label={`Editar ${COMPETENCE_LABELS[competence]}${recovery ? " · recuperação" : ""}`}
      title={`Editar ${COMPETENCE_LABELS[competence]}`}
      aria-haspopup="dialog"
      onClick={(event) => onEdit(competence, event.currentTarget)}
    >
      <Pencil aria-hidden="true" />
    </Button>
  );
}
