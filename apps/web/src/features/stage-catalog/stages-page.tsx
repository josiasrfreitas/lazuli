"use client";
import { useState, type ReactNode } from "react";
import { EmptyState, Input, type DataTableState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { StageCatalogList } from "./catalog-list";
import { StagePrograms } from "./detail";
import { StageLoading } from "./loading";
import type { StageSummary } from "./types";
import styles from "./catalog.module.css";

function catalogState(
  rows: StageSummary[],
  query: { isPending: boolean; isError: boolean; total: number },
): DataTableState<StageSummary> {
  if (query.isPending) return { kind: "loading" };
  if (query.isError) return { kind: "error" };
  if (rows.length > 0) return { kind: "data", rows };
  return { kind: query.total > 0 ? "noResults" : "empty" };
}

export function StagesPage(): ReactNode {
  const query = trpc.teachingPrograms.catalog.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const stages = query.data ?? [];
  const selected =
    stages.find((stage) => stage.id === selectedId) ??
    stages.find((stage) => stage.internalCode === "F1" && stage._count.teachingPrograms > 0) ??
    stages.find((stage) => stage._count.teachingPrograms > 0) ??
    stages[0];
  const needle = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = stages.filter((stage) =>
    `${stage.name} ${stage.internalCode} ${stage.track.name}`
      .toLocaleLowerCase("pt-BR")
      .includes(needle),
  );
  const state = catalogState(filtered, { ...query, total: stages.length });
  let detail: ReactNode = (
    <div className={styles.unavailable}>
      <EmptyState
        title="Programação dos estágios"
        description="Selecione um estágio para consultar suas unidades, lições e provas."
      />
    </div>
  );
  if (query.isPending) detail = <StageLoading />;
  else if (selected) detail = <StagePrograms key={selected.id} stage={selected} />;
  return (
    <section className={styles.workspace} aria-label="Estágios">
      <div className={styles.canvas}>
        <div className={styles.catalog}>
          <CatalogPane
            state={state}
            search={search}
            onSearch={setSearch}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            onRetry={() => void query.refetch()}
            total={stages.length}
            shown={filtered.length}
            loaded={query.data !== undefined}
          />
          {detail}
        </div>
      </div>
    </section>
  );
}

type CatalogPaneProps = {
  state: DataTableState<StageSummary>;
  search: string;
  onSearch: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
  total: number;
  shown: number;
  loaded: boolean;
};
function CatalogPane({
  state,
  search,
  onSearch,
  selectedId,
  onSelect,
  onRetry,
  total,
  shown,
  loaded,
}: CatalogPaneProps): ReactNode {
  return (
    <section className={styles.catalogList} aria-label="Catálogo de estágios">
      <div className={styles.catalogHeading}>
        <h1>Estágios</h1>
      </div>
      <div className={styles.listTools}>
        <Input
          name="stage-search"
          size="sm"
          placeholder="Buscar track, estágio ou código…"
          aria-label="Buscar track, estágio ou código"
          autoComplete="off"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <StageCatalogList
        state={state}
        selectedId={selectedId}
        onSelect={(stage) => onSelect(stage.id)}
        onRetry={onRetry}
        footer={
          loaded ? (
            <p className="px-3 py-2 text-caption text-muted-foreground">
              {shown} de {total} estágios
            </p>
          ) : undefined
        }
      />
    </section>
  );
}
