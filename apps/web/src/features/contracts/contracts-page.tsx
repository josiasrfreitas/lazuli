"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Plus, Search } from "lucide-react";

import {
  Badge,
  Button,
  DataTablePage,
  Input,
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
import { debounce } from "~/lib/debounce";
import { trpc } from "~/lib/trpc";

import { NewContractDialog } from "./new-contract-dialog";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MAX_LENGTH = 80;

export function ContractsPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const commitSearch = useMemo(
    () =>
      debounce((value: string) => {
        setQuery(value);
        setPage(1);
      }, SEARCH_DEBOUNCE_MS),
    [],
  );
  useEffect(() => () => commitSearch.cancel(), [commitSearch]);
  const utils = trpc.useUtils();
  const list = trpc.finance.listContracts.useQuery({ page, query });
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
        controls={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-48 flex-1 sm:w-64 sm:flex-none">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Buscar contrato por aluno ou pagador"
                className="pl-8"
                type="search"
                placeholder="Buscar aluno ou pagador"
                maxLength={SEARCH_MAX_LENGTH}
                size="sm"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  commitSearch(event.target.value);
                }}
              />
            </div>
            <Button onClick={() => setCreating(true)} size="sm">
              <Plus aria-hidden="true" className="size-4" />
              Novo contrato
            </Button>
          </div>
        }
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
                <TableHead>Situação</TableHead>
                <TableHead>Estágio / turma</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Pagador</TableHead>
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
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "INADIMPLENTE"
                          ? "destructive"
                          : row.status === "EM_DIA"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {row.status === "INADIMPLENTE"
                        ? "Inadimplente"
                        : row.status === "EM_DIA"
                          ? "Em dia"
                          : row.status === "QUITADO"
                            ? "Quitado"
                            : "Cancelado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.student.placements.length > 0
                      ? row.student.placements.map((placement) => (
                          <span key={`${placement.classCode}-${placement.stage}`} className="block">
                            {placement.stage}
                            <span className="block text-caption text-muted-foreground">
                              {placement.classCode} · {placement.modality}
                            </span>
                          </span>
                        ))
                      : "—"}
                  </TableCell>
                  <TableCell className="font-numeric tabular-nums">
                    {formatBRLFromCents(row.monthlyAmountCents)}
                  </TableCell>
                  <TableCell>
                    {row.startsOn.split("-").reverse().join("/")}–
                    {row.endsOn.split("-").reverse().join("/")}
                  </TableCell>
                  <TableCell>{row.payer.name}</TableCell>
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
