"use client";

import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ContractListRow } from "./contract-list-row";

const PAGE_SIZE = 20;
const COLUMN_COUNT = 6;
type ContractRows = RouterOutputs["finance"]["listContracts"]["rows"];

function Rows({
  rows,
  pending,
  failed,
  onRetry,
}: {
  rows: ContractRows | undefined;
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
}): ReactElement {
  return (
    <TableBody>
      {pending && (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT}>Carregando contratos…</TableCell>
        </TableRow>
      )}
      {failed && (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT}>
            <span role="alert">Não foi possível carregar os contratos.</span>{" "}
            <Button type="button" variant="link" onClick={onRetry}>
              Tentar novamente
            </Button>
          </TableCell>
        </TableRow>
      )}
      {rows?.length === 0 && (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT}>Nenhum contrato cadastrado.</TableCell>
        </TableRow>
      )}
      {rows?.map((row) => (
        <ContractListRow key={row.id} row={row} />
      ))}
    </TableBody>
  );
}

export function ContractsTable({
  page,
  query,
  onPageChange,
}: {
  page: number;
  query: string;
  onPageChange: (page: number) => void;
}): ReactElement {
  const list = trpc.finance.listContracts.useQuery({ page, query });
  return (
    <TableContainer
      viewportBound
      footer={
        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={onPageChange}
          itemLabel={{ singular: "contrato", plural: "contratos" }}
          {...(list.data
            ? {
                pageCount: Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)),
                totalItems: list.data.total,
              }
            : { loading: true })}
        />
      }
    >
      <Table aria-label="Contratos mensais" density="compact">
        <TableHeader sticky>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Estágio / turma</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Vigência</TableHead>
            <TableHead>Pagador</TableHead>
          </TableRow>
        </TableHeader>
        <Rows
          rows={list.data?.rows}
          pending={list.isPending}
          failed={list.isError}
          onRetry={() => void list.refetch()}
        />
      </Table>
    </TableContainer>
  );
}
