import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DataTable,
  type DataTableColumn,
  type DataTableState,
} from "../../src/components/data-table.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
type Row = { id: string; name: string; amount: string };
const columns: readonly DataTableColumn<Row>[] = [
  { id: "name", header: "Nome", width: "wide", cell: (row) => row.name },
  { id: "amount", header: "Valor", numeric: true, cell: (row) => row.amount },
];
const rows = [{ id: "one", name: "Ana", amount: "R$ 250,00" }];

function render(state: DataTableState<Row>): string {
  return renderToStaticMarkup(
    createElement(DataTable<Row>, {
      label: "Tabela de teste",
      columns,
      state,
      onRetry: () => {},
      empty: { title: "Nenhum item cadastrado", description: "Cadastre um item." },
      errorTitle: "Não foi possível carregar os itens",
      pagination: { page: 1, pageSize: 10, pageCount: 1, totalItems: 1 },
    }),
  );
}

void it("renders declared columns, standard density, stable headers and pinned pagination", () => {
  const markup = render({ kind: "data", rows });
  assert.match(markup, /aria-label="Tabela de teste"/u);
  assert.match(markup, /data-density="default"/u);
  assert.match(markup, /data-sticky="true"/u);
  assert.match(markup, /scope="col">Nome<\/th>/u);
  assert.match(markup, /text-right[^>]+scope="col">Valor<\/th>/u);
  assert.match(markup, />Ana<\/td>/u);
  assert.match(markup, /text-right[^>]+>R\$ 250,00<\/td>/u);
  assert.equal((markup.match(/data-slot="table-cell"/gu) ?? []).length, 2);
  assert.ok(markup.indexOf('data-slot="table-pagination"') > markup.indexOf("</table>"));
});

void it("keeps column structure and shared spacing in the loading state", () => {
  const markup = render({ kind: "loading" });
  assert.match(markup, /colSpan="2" role="status">Carregando dados da tabela/u);
  assert.equal((markup.match(/data-slot="table-skeleton-cell"/gu) ?? []).length, 20);
  assert.doesNotMatch(markup, />Ana<\/td>/u);
  assert.match(markup, /data-slot="table-pagination"/u);
});

for (const [kind, message] of [
  ["empty", "Nenhum item cadastrado"],
  ["noResults", "Nenhum resultado encontrado"],
  ["error", "Não foi possível carregar os itens"],
] as const) {
  void it(`renders the ${kind} state inside the same table frame`, () => {
    const markup = render({ kind });
    assert.match(markup, /colSpan="2"[^>]+data-slot="table-empty"/u);
    assert.ok(markup.includes(message));
    assert.match(markup, /data-slot="table-pagination"/u);
  });
}
