import { createRef } from "react";

import { DataTablePage } from "../src/components/data-table-page.js";

const pageRef = createRef<HTMLDivElement>();

export const pageWithFixedFurniture = (
  <DataTablePage
    controls={<div>Busca e filtros</div>}
    title="Alunos"
    summary={<span>24 alunos</span>}
    ref={pageRef}
  >
    <div>Tabela</div>
  </DataTablePage>
);

export const pageWithoutOptionalControls = (
  <DataTablePage title="Alunos">
    <div>Tabela</div>
  </DataTablePage>
);

// @ts-expect-error A listing needs a visible page header.
export const pageWithoutHeader = <DataTablePage>Tabela</DataTablePage>;

export const pageWithCustomHeader = (
  // @ts-expect-error Page heading composition belongs to DataTablePage, not each listing.
  <DataTablePage title="Alunos" header={<h1>Alunos</h1>}>
    Tabela
  </DataTablePage>
);
