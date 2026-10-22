import type { JSX as ReactJSX } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Button, DataTable, type DataTableColumn } from "@lazuli/ui";
import { KIND_LABELS, dateLabel, type Planning } from "./shared";
import styles from "./planning.module.css";

type RecordRow = Planning["records"][number];

export function PlanningRecords({
  data,
  records,
  pagination,
}: {
  data: Planning;
  records: Planning["records"];
  pagination?: import("@lazuli/ui").TablePaginationConfig | undefined;
}): ReactJSX.Element {
  return (
    <DataTable
      label="Conteúdo registrado nas aulas"
      {...(pagination ? { pagination } : {})}
      columns={recordColumns(Boolean(data.scope.student))}
      state={
        records.length > 0
          ? { kind: "data", rows: records }
          : { kind: data.records.length > 0 ? "noResults" : "empty" }
      }
      empty={{
        title: "Nenhum conteúdo registrado",
        description: "O relato do professor aparecerá aqui após o registro da aula.",
      }}
      errorTitle="Não foi possível carregar os registros"
      onRetry={() => {}}
    />
  );
}

function recordColumns(student: boolean): DataTableColumn<RecordRow>[] {
  const columns: DataTableColumn<RecordRow>[] = [
    { id: "date", header: "Aula", width: "narrow", cell: recordDate },
    { id: "content", header: "O que foi trabalhado", width: "wide", cell: recordContent },
  ];
  if (!student) {
    columns.push({ id: "open", header: "", width: "narrow", cell: recordLink });
  }
  return columns;
}

function recordDate(row: RecordRow): ReactJSX.Element {
  return (
    <div className={styles.cell}>
      <strong>{dateLabel(row.date)}</strong>
      <span>{row.time}</span>
    </div>
  );
}

function recordContent(row: RecordRow): ReactJSX.Element {
  const content = row.content;
  const pageRange =
    content.pageTo && content.pageTo !== content.pageFrom ? `–${content.pageTo}` : "";
  const pages = content.pageFrom === null ? "" : ` · Pág. ${content.pageFrom}${pageRange}`;
  return (
    <div className={styles.recordContent}>
      <span>
        {KIND_LABELS[content.kind]}
        {pages}
      </span>
      <p>{content.account}</p>
      {content.reference && <small>{content.reference}</small>}
    </div>
  );
}

function recordLink(row: RecordRow): ReactJSX.Element {
  return (
    <Button
      variant="link"
      size="inline"
      nativeButton={false}
      render={<Link href={`/turmas/${row.classId}?secao=aulas&aula=${row.id}#aulas-da-turma`} />}
    >
      <ArrowUpRight aria-hidden="true" />
      Abrir aula
    </Button>
  );
}
