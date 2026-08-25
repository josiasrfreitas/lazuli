import { createRef } from "react";

import { TableCell, TableEmpty, TableHead } from "../src/components/table-cells.js";
import { TableSkeleton } from "../src/components/table-skeleton.js";
import {
  Table,
  TableBody,
  TableCaption,
  TableContainer,
  TableFooter,
  TableHeader,
  TableRow,
} from "../src/components/table.js";

const containerRef = createRef<HTMLDivElement>();
const tableRef = createRef<HTMLTableElement>();
const rowRef = createRef<HTMLTableRowElement>();
const cellRef = createRef<HTMLTableCellElement>();

export const tableWithRefs = (
  <TableContainer ref={containerRef}>
    <Table density="compact" ref={tableRef}>
      <TableCaption>Parcelas do contrato</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead onSort={() => {}} ref={cellRef} sortDirection="ascending">
            Aluno
          </TableHead>
          <TableHead numeric>Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow ref={rowRef} selected>
          <TableCell>Ana Souza</TableCell>
          <TableCell numeric>R$ 480,00</TableCell>
        </TableRow>
        <TableEmpty colSpan={2}>Nenhuma parcela encontrada.</TableEmpty>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell numeric>R$ 480,00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  </TableContainer>
);

export const tableLoading = (
  <Table>
    <TableBody>
      <TableSkeleton columns={3} numericColumns={[2]} rows={5} />
    </TableBody>
  </Table>
);

// @ts-expect-error TableSkeleton must know how many columns to draw.
export const skeletonWithoutColumns = <TableSkeleton rows={2} />;

// @ts-expect-error TableEmpty must span the table's columns.
export const emptyWithoutColSpan = <TableEmpty>Nenhum resultado.</TableEmpty>;

// @ts-expect-error Sort direction is limited to the ARIA values.
export const invalidSortDirection = <TableHead sortDirection="asc">Aluno</TableHead>;
