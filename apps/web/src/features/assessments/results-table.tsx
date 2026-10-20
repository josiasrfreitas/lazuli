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

export function AssessmentResults({
  data,
  recovery = false,
  onEdit,
}: {
  data?: Assessment;
  recovery?: boolean;
  onEdit?: (competence: Competence, trigger: HTMLButtonElement) => void;
}) {
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
        <TableBody>
          {ASSESSMENT_ROW_ORDER.map((competence) => {
            const result = data?.results.find((row) => row.competence === competence);
            const value = result ? (recovery ? result.effective : result.average) : null;
            const scores = result
              ? recovery
                ? [result.recovery]
                : [result.blockOne, result.blockTwo]
              : Array.from({ length: recovery ? 1 : 2 }, () => null);
            return (
              <TableRow key={competence} interactive={false}>
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
                <TableCell numeric className="px-1 sm:px-1.5">
                  {result ? (
                    <span
                      className={
                        value === null ? styles.muted : value >= 60 ? styles.passed : styles.below
                      }
                    >
                      {gradeLabel(value)}
                    </span>
                  ) : (
                    <InlineSkeleton className="h-3 w-5 max-w-full rounded-sm" />
                  )}
                </TableCell>
                {actions && (
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
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
