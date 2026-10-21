import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Button, DataTable } from "@lazuli/ui";
import { KIND_LABELS, dateLabel, type Planning } from "./shared";
import styles from "./planning.module.css";

export function PlanningRecords({
  data,
  records,
  pagination,
}: {
  data: Planning;
  records: Planning["records"];
  pagination?: import("@lazuli/ui").TablePaginationConfig | undefined;
}) {
  return (
    <DataTable
      label="Conteúdo registrado nas aulas"
      {...(pagination ? { pagination } : {})}
      columns={[
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
                {row.content.pageFrom !== null
                  ? ` · Pág. ${row.content.pageFrom}${row.content.pageTo && row.content.pageTo !== row.content.pageFrom ? `–${row.content.pageTo}` : ""}`
                  : ""}
              </span>
              <p>{row.content.account}</p>
              {row.content.reference && <small>{row.content.reference}</small>}
            </div>
          ),
        },
        ...(!data.scope.student
          ? [
              {
                id: "open",
                header: "",
                width: "narrow" as const,
                cell: (row: Planning["records"][number]) => (
                  <Button
                    variant="link"
                    size="inline"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/turmas/${row.classId}?secao=aulas&aula=${row.id}#aulas-da-turma`}
                      />
                    }
                  >
                    <ArrowUpRight aria-hidden="true" />
                    Abrir aula
                  </Button>
                ),
              },
            ]
          : []),
      ]}
      state={
        records.length
          ? { kind: "data", rows: records }
          : { kind: data.records.length ? "noResults" : "empty" }
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
