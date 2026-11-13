"use client";
import { useState, type ReactElement, type RefObject } from "react";
import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DataTable,
  SegmentedControl,
  SegmentedControlItem,
  type DataTableColumn,
} from "@lazuli/ui";
import styles from "./teacher-overview.module.css";
import { formatClassSchedule } from "~/features/classes/labels";
export type MetricDetail = "health" | "learning" | "attendance" | "followup";
type Metrics = RouterOutputs["teachers"]["metrics"];
type Row = {
  id: string;
  name: string;
  href?: string;
  score?: number | null;
  grades?: number | null;
  absence?: number | null;
  description: string;
};
const TITLES = {
  health: "Saúde dos alunos",
  learning: "Aprendizagem",
  attendance: "Frequência",
  followup: "Acompanhamento",
};
export const metricNumber = (value: number | null | undefined): string =>
  value == null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const PAGE_SIZE = 10;
export function TeacherMetricDetails({
  data,
  detail,
  onClose,
  returnFocus,
}: {
  data: Metrics;
  detail: MetricDetail;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}): ReactElement {
  const [group, setGroup] = useState("classes");
  const [page, setPage] = useState(1);
  const rows = metricRows(data, detail, group);
  const columns: DataTableColumn<Row>[] = [
    {
      id: "name",
      header: group === "books" ? "Livro" : group === "classes" ? "Turma" : "Aluno",
      width: "wide",
      cell: (row) =>
        row.href ? (
          <Link className={styles.detailLink} href={row.href}>
            {row.name}
          </Link>
        ) : (
          row.name
        ),
    },
    ...(detail === "health"
      ? [
          {
            id: "score",
            header: group === "classes" ? "Score médio" : "Score individual",
            numeric: true,
            cell: (row: Row) => metricNumber(row.score),
          },
        ]
      : []),
    ...(detail === "learning"
      ? [
          {
            id: "grades",
            header: "Média das notas",
            numeric: true,
            cell: (row: Row) => metricNumber(row.grades),
          },
        ]
      : []),
    ...(detail === "attendance"
      ? [
          {
            id: "absence",
            header: "Faltas",
            numeric: true,
            cell: (row: Row) => (row.absence == null ? "—" : `${metricNumber(row.absence)}%`),
          },
        ]
      : []),
    { id: "context", header: "Contexto", width: "wide", cell: (row) => row.description },
  ];
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-4xl" finalFocus={returnFocus}>
          <DialogHeader>
            <DialogTitle>{TITLES[detail]} por turma e aluno</DialogTitle>
            <DialogDescription>
              {detail === "health"
                ? "Média dos scores dos alunos atuais. Cada aluno conta uma vez; dados ausentes não viram zero. O score individual inclui frequência (35), notas (30), ocorrências (20) e acompanhamento (15), redistribuindo pesos quando faltam dados."
                : detail === "learning"
                  ? "Notas dentro do semestre, matrícula e período de atuação. A média dá o mesmo peso a cada aluno; notas de vínculos ambíguos ficam de fora."
                  : detail === "attendance"
                    ? "Percentuais calculados pelos minutos das aulas com chamada confirmada, sem descontar reposições. Aulas futuras e canceladas não entram."
                    : "Ocorrências dos alunos atuais neste semestre. Uma intervenção vinculada não significa que a ocorrência foi encerrada nem que o professor foi seu autor."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.metricDetailsBody}>
              {detail === "learning" && data.ambiguousGrades > 0 && (
                <p>
                  {data.ambiguousGrades} notas sem vínculo inequívoco com uma turma não foram
                  incluídas.
                </p>
              )}
              {detail === "attendance" && data.attendance.missingRows > 0 && (
                <p>
                  {data.attendance.missingRows} registros individuais ausentes em chamadas
                  confirmadas foram excluídos do percentual.
                </p>
              )}
              {detail !== "followup" && (
                <SegmentedControl
                  size="sm"
                  value={group}
                  aria-label="Agrupar indicadores"
                  onValueChange={(value) => {
                    if (value) {
                      setGroup(value);
                      setPage(1);
                    }
                  }}
                >
                  {detail === "learning" && (
                    <SegmentedControlItem value="books">Por livro</SegmentedControlItem>
                  )}
                  <SegmentedControlItem value="students">Por aluno</SegmentedControlItem>
                  <SegmentedControlItem value="classes">Por turma</SegmentedControlItem>
                </SegmentedControl>
              )}
              <DataTable
                label={`Detalhamento de ${TITLES[detail]}`}
                columns={columns}
                state={
                  rows.length
                    ? { kind: "data", rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) }
                    : { kind: "empty" }
                }
                pagination={{
                  page,
                  pageSize: PAGE_SIZE,
                  totalItems: rows.length,
                  pageCount: Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
                  onPageChange: setPage,
                }}
                onRetry={() => {}}
                empty={{
                  title: "Sem dados neste recorte",
                  description: "Os indicadores aparecerão conforme os registros forem concluídos.",
                }}
                errorTitle="Não foi possível carregar os detalhes"
              />
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
function metricRows(data: Metrics, detail: MetricDetail, group: string): Row[] {
  if (detail === "followup")
    return data.occurrences.map((row) => ({
      id: row.id,
      name: row.name,
      href: `/alunos/${row.studentId}?secao=pedagogico`,
      description: `${row.title} · ${row.status === "CLOSED" ? "Encerrada" : row.status === "FOLLOWING_UP" ? "Em acompanhamento" : "Aberta"} · ${row.accompanied ? "Com intervenção" : "Sem intervenção"}`,
    }));
  if (group === "books")
    return data.books.map((row) => ({
      id: row.id,
      name: row.name,
      grades: row.average,
      description: `${row.assessedStudents}/${row.studentCount} alunos avaliados · ${row.gradeCount} notas · B1 ${metricNumber(row.phases[0]?.average)} / B2 ${metricNumber(row.phases[1]?.average)} / Rec. ${metricNumber(row.phases[2]?.average)}`,
    }));
  if (group === "classes")
    return data.classes.map((row) => ({
      id: row.id,
      name: [row.name, row.stages.join(", ")].filter(Boolean).join(" · "),
      href: `/turmas/${row.id}`,
      score: row.score,
      grades: row.grades,
      absence: row.attendance.percent,
      description: `${formatClassSchedule(row.schedule)} · ${row.studentCount} alunos · ${row.calls.confirmed} de ${row.calls.due} chamadas confirmadas`,
    }));
  return data.students
    .toSorted((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity))
    .map((row) => ({
      id: row.id,
      name: row.name,
      href: `/alunos/${row.id}?secao=pedagogico`,
      score: row.score,
      grades: row.grades,
      absence: row.attendance.percent,
      description:
        detail === "health"
          ? `${row.availableIndicators}/4 indicadores · ${row.healthGradeCount} notas · ${row.healthHeldSessions} aulas no score`
          : `${row.gradeCount} notas · ${row.attendance.confirmed}/${row.attendance.due} chamadas confirmadas`,
    }));
}
