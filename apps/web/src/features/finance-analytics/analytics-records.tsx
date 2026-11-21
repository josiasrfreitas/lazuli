import { useState } from "react";
import { DataTable, type DataTableColumn } from "@lazuli/ui";
import type { ReactElement } from "react";

const PAGE_SIZE = 10;
export function AnalyticsRecords<Row extends { id: string }>({
  label,
  rows,
  columns,
}: {
  label: string;
  rows: Row[];
  columns: DataTableColumn<Row>[];
}): ReactElement {
  const [requested, setRequested] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(requested, pages);
  return (
    <div className="min-w-0">
      <DataTable
        label={label}
        columns={columns}
        state={{ kind: "data", rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) }}
        pagination={{
          page,
          pageCount: pages,
          pageSize: PAGE_SIZE,
          totalItems: rows.length,
          onPageChange: setRequested,
        }}
        empty={{ title: "Sem registros", description: "Nenhum aluno neste recorte." }}
        errorTitle="Não foi possível carregar a lista"
        onRetry={() => {}}
      />
    </div>
  );
}
