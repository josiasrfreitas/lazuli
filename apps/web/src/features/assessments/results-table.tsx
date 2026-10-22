import type { JSX as ReactJSX } from "react";
import { Pencil } from "lucide-react";
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
  type Assessment,
  type Competence,
} from "./shared";
import styles from "./assessment-workspace.module.css";

const PASSING_SCORE = 60;

export function AssessmentResults({
  data,
  recovery = false,
  onEdit,
}: {
  data?: Assessment;
  recovery?: boolean;
  onEdit?: (competence: Competence, trigger: HTMLButtonElement) => void;
}): ReactJSX.Element {
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
            <ResultsRow
              key={competence}
              competence={competence}
              result={data?.results.find((row) => row.competence === competence)}
              recovery={recovery}
              actions={actions}
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
}): ReactJSX.Element {
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

function ResultsRow({
  competence,
  result,
  recovery,
  actions,
  onEdit,
}: {
  competence: Competence;
  result: Assessment["results"][number] | undefined;
  recovery: boolean;
  actions: boolean;
  onEdit: ((competence: Competence, trigger: HTMLButtonElement) => void) | undefined;
}): ReactJSX.Element {
  const value = result ? (recovery ? result.effective : result.average) : null;
  let scores = result ? [result.blockOne, result.blockTwo] : [null, null];
  if (recovery) scores = [result?.recovery ?? null];
  return (
    <TableRow interactive={false}>
      <TableCell className="whitespace-nowrap">{COMPETENCE_LABELS[competence]}</TableCell>
      {scores.map((score, index) => (
        <TableCell key={index} numeric className="px-1 sm:px-1.5">
          {result ? (
            gradeLabel(score)
          ) : (
            <InlineSkeleton className="h-3 w-5 max-w-full rounded-sm" />
          )}
        </TableCell>
      ))}
      <ResultValue result={result} value={value} />
      {actions && <ResultEdit competence={competence} recovery={recovery} onEdit={onEdit} />}
    </TableRow>
  );
}

function ResultValue({
  result,
  value,
}: {
  result: Assessment["results"][number] | undefined;
  value: number | null;
}): ReactJSX.Element {
  let className = styles.muted;
  if (value !== null && value >= PASSING_SCORE) className = styles.passed;
  else if (value !== null) className = styles.below;
  return (
    <TableCell numeric className="px-1 sm:px-1.5">
      {result ? (
        <span className={className}>{gradeLabel(value)}</span>
      ) : (
        <InlineSkeleton className="h-3 w-5 max-w-full rounded-sm" />
      )}
    </TableCell>
  );
}

function ResultEdit({
  competence,
  recovery,
  onEdit,
}: {
  competence: Competence;
  recovery: boolean;
  onEdit: ((competence: Competence, trigger: HTMLButtonElement) => void) | undefined;
}): ReactJSX.Element {
  return (
    <TableCell className="px-1">
      {onEdit ? (
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
      ) : (
        <InlineSkeleton className="size-8 rounded-sm" />
      )}
    </TableCell>
  );
}
