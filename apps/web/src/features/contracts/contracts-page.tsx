"use client";

import { useState, type ReactElement } from "react";

import {
  Button,
  DataTablePage,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from "@lazuli/ui";

import { formatBRLFromCents } from "~/lib/format";
import { trpc } from "~/lib/trpc";

import { NewContractDialog } from "./new-contract-dialog";

export function ContractsPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const utils = trpc.useUtils();
  const list = trpc.finance.listContracts.useQuery({ page });
  return (
    <>
      <DataTablePage
        className="p-4 sm:p-6"
        header={
          <div>
            <h1 className="font-display text-h2 font-semibold">Contratos</h1>
            <p className="text-caption text-muted-foreground">
              Acordos mensais com aluno e pagador existentes
            </p>
          </div>
        }
        controls={<Button onClick={() => setCreating(true)}>Novo contrato</Button>}
      >
        <TableContainer
          viewportBound
          footer={
            <TablePagination
              page={page}
              pageSize={20}
              onPageChange={setPage}
              itemLabel={{ singular: "contrato", plural: "contratos" }}
              {...(list.data
                ? {
                    pageCount: Math.max(1, Math.ceil(list.data.total / 20)),
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
                <TableHead>Pagador</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Principal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isPending && (
                <TableRow>
                  <TableCell colSpan={6}>Carregando contratos…</TableCell>
                </TableRow>
              )}
              {list.isError && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <span role="alert">Não foi possível carregar os contratos.</span>{" "}
                    <Button type="button" variant="link" onClick={() => void list.refetch()}>
                      Tentar novamente
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {list.data?.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>Nenhum contrato cadastrado.</TableCell>
                </TableRow>
              )}
              {list.data?.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.student.fullName}</TableCell>
                  <TableCell>{row.payer.name}</TableCell>
                  <TableCell>{row.agreedOn.split("-").reverse().join("/")}</TableCell>
                  <TableCell>
                    {row.startsOn.split("-").reverse().join("/")}–
                    {row.endsOn.split("-").reverse().join("/")}
                  </TableCell>
                  <TableCell>
                    {row.installmentCount} × {formatBRLFromCents(row.monthlyAmountCents)} · primeira{" "}
                    {row.firstDueDate.split("-").reverse().join("/")}
                  </TableCell>
                  <TableCell className="font-numeric tabular-nums">
                    {formatBRLFromCents(row.principalAmountCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DataTablePage>
      <NewContractDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => void utils.finance.listContracts.invalidate()}
      />
    </>
  );
}
