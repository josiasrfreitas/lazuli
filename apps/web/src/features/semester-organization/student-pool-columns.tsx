import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, Button, type DataTableColumn } from "@lazuli/ui";
import type { SemesterBoard } from "./shared";

export type Student = RouterOutputs["semesterOrganization"]["students"]["rows"][number];

export function studentPoolColumns({
  board,
  readOnly,
  onOrganize,
}: {
  board: SemesterBoard;
  readOnly: boolean;
  onOrganize: (studentId: string) => void;
}): DataTableColumn<Student>[] {
  return [
    { id: "name", header: "Aluno", width: "wide", cell: studentName },
    { id: "current", header: "Percurso atual", width: "wide", cell: currentStages },
    {
      id: "proposals",
      header: "Próximo semestre",
      width: "medium",
      cell: (row) => proposedClasses(row, board),
    },
    {
      id: "action",
      header: "",
      width: "narrow",
      cell: (row) => (
        <Button
          size="sm"
          variant="secondary"
          disabled={readOnly}
          onClick={() => onOrganize(row.id)}
        >
          Organizar aluno
        </Button>
      ),
    },
  ];
}

function studentName(row: Student): ReactJSX.Element {
  return (
    <div className="grid gap-1">
      <span className="font-medium">{row.name}</span>
      {row.status !== "ACTIVE" && (
        <Badge variant="neutral">{row.status === "SUSPENDED" ? "Suspenso" : "Inativo"}</Badge>
      )}
    </div>
  );
}

function currentStages(row: Student): ReactJSX.Element {
  if (row.current.length === 0) {
    return <span className="text-muted-foreground">Sem vínculo vigente</span>;
  }
  return (
    <div className="grid gap-1">
      {row.current.map((item) => (
        <div key={item.id}>
          <p>
            {item.stageCode} · {item.scheduleType === "PERSONALIZED" ? "PPT" : "Regular"}
          </p>
          <p className="text-caption text-muted-foreground">{item.className}</p>
        </div>
      ))}
    </div>
  );
}

function proposedClasses(row: Student, board: SemesterBoard): ReactJSX.Element {
  const proposals = board.placements.filter((item) => item.studentId === row.id);
  if (proposals.length === 0) {
    return <span className="text-muted-foreground">Sem proposta</span>;
  }
  return (
    <div className="grid gap-1">
      {proposals.map((item) => (
        <span key={item.id}>
          {board.plans.find((plan) => plan.id === item.planId)?.name ?? "Ainda sem turma"}
        </span>
      ))}
    </div>
  );
}
