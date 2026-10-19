import type { ReactElement } from "react";
import {
  Badge,
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
  COMPETENCES,
  COMPETENCE_LABELS,
  COMPETENCE_VISUALS,
  PHASE_LABELS,
  gradeLabel,
  type Assessment,
} from "./shared";

export function AssessmentResults({ data }: { data?: Assessment }): ReactElement {
  return (
    <TableContainer>
      <Table aria-label="Notas por competência" density="compact" aria-busy={!data || undefined}>
        <TableHeader>
          <TableRow interactive={false}>
            <TableHead>Competência</TableHead>
            <TableHead numeric>{PHASE_LABELS.BLOCK_ONE}</TableHead>
            <TableHead numeric>{PHASE_LABELS.BLOCK_TWO}</TableHead>
            <TableHead numeric>Média</TableHead>
            <TableHead numeric>Recup.</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.results.map((row) => row.competence) ?? COMPETENCES).map((competence) => {
            const result = data?.results.find((row) => row.competence === competence);
            return (
              <TableRow key={competence} interactive={false}>
                <TableCell>
                  <Badge variant={COMPETENCE_VISUALS[competence].badge}>
                    {COMPETENCE_LABELS[competence]}
                  </Badge>
                </TableCell>
                <TableCell numeric>
                  {result ? gradeLabel(result.blockOne) : <InlineSkeleton className="w-8" />}
                </TableCell>
                <TableCell numeric>
                  {result ? gradeLabel(result.blockTwo) : <InlineSkeleton className="w-8" />}
                </TableCell>
                <TableCell numeric>
                  {result ? gradeLabel(result.average) : <InlineSkeleton className="w-8" />}
                </TableCell>
                <TableCell numeric>
                  {result ? gradeLabel(result.recovery) : <InlineSkeleton className="w-8" />}
                </TableCell>
                <TableCell>
                  {result ? (
                    <Badge
                      variant={
                        result.passed === null ? "neutral" : result.passed ? "success" : "warning"
                      }
                    >
                      {result.passed === null
                        ? "Incompleto"
                        : result.passed
                          ? "Suficiente"
                          : "Abaixo de 60"}
                    </Badge>
                  ) : (
                    <InlineSkeleton className="w-20" />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
