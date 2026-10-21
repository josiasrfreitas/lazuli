import type { ReactElement } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Button, DataTable, type TablePaginationConfig, type DataTableColumn } from "@lazuli/ui";
import { KIND_LABELS, dateLabel, type Planning } from "./shared";
import styles from "./planning.module.css";

export function PlanningRecords({
  data,
  records,
  pagination,
}: {
  data: Planning;
  records: Planning["records"];
  pagination?: TablePaginationConfig | undefined;
}): ReactElement {
  return (
    <DataTable
      {...(pagination ? { pagination } : {})}
      label="Conteúdo registrado nas aulas"
      columns={recordColumns(data)}
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

function recordColumns(data: Planning): DataTableColumn<Planning["records"][number]>[] {
  return [
    {
      id: "date",
      header: "Aula",
      width: "narrow",
      cell: (row: Planning["records"][number]) => (
        <div className={styles.cell}>
          <strong>{dateLabel(row.date)}</strong>
          <span>{row.time}</span>
        </div>
      ),
    },
    {
      id: "content",
      header: "O que foi trabalhado",
      width: "wide",
      cell: (row) => (
        <div className={styles.recordContent}>
          <span>
            {KIND_LABELS[row.content.kind]}
            {row.content.pageFrom === null
              ? ""
              : ` · Pág. ${row.content.pageFrom}${row.content.pageTo && row.content.pageTo !== row.content.pageFrom ? `–${row.content.pageTo}` : ""}`}
          </span>
          <p>{row.content.account}</p>
          {row.content.reference && <small>{row.content.reference}</small>}
        </div>
      ),
    },
    ...(data.scope.student ? [] : [openColumn]),
  ];
}

const openColumn: DataTableColumn<Planning["records"][number]> = {
  id: "open",
  header: "",
  width: "narrow" as const,
  cell: (row: Planning["records"][number]) => (
    <Button
      variant="link"
      size="inline"
      nativeButton={false}
      render={<Link href={`/aulas/${row.id}`} />}
    >
      <ArrowUpRight aria-hidden="true" />
      Abrir aula
    </Button>
  ),
};
