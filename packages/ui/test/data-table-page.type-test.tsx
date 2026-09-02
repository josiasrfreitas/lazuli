import { createRef } from "react";

import { DataTablePage } from "../src/components/data-table-page.js";

const pageRef = createRef<HTMLDivElement>();

export const pageWithFixedFurniture = (
  <DataTablePage controls={<div>Busca e filtros</div>} header={<h1>Alunos</h1>} ref={pageRef}>
    <div>Tabela</div>
  </DataTablePage>
);

export const pageWithoutOptionalControls = (
  <DataTablePage header={<h1>Alunos</h1>}>
    <div>Tabela</div>
  </DataTablePage>
);

// @ts-expect-error A listing needs a visible page header.
export const pageWithoutHeader = <DataTablePage>Tabela</DataTablePage>;
