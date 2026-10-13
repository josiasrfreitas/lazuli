import type { ReactElement } from "react";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@lazuli/ui";
import {
  COMPETENCE_LABELS,
  COMPETENCE_VISUALS,
  PHASE_LABELS,
  gradeLabel,
  type Assessment,
} from "./shared";

export function AssessmentResults({ data }: { data: Assessment }): ReactElement {
  return (
    <TableContainer>
      <Table aria-label="Notas por competência" density="compact">
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
          {data.results.map((result) => (
            <TableRow key={result.competence} interactive={false}>
              <TableCell>
                <Badge variant={COMPETENCE_VISUALS[result.competence].badge}>
                  {COMPETENCE_LABELS[result.competence]}
                </Badge>
              </TableCell>
              <TableCell numeric>{gradeLabel(result.blockOne)}</TableCell>
              <TableCell numeric>{gradeLabel(result.blockTwo)}</TableCell>
              <TableCell numeric>{gradeLabel(result.average)}</TableCell>
              <TableCell numeric>{gradeLabel(result.recovery)}</TableCell>
              <TableCell>
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
