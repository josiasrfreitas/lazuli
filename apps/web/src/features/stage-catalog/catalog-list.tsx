import type { ReactNode } from "react";
import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  type DataTableState,
} from "@lazuli/ui";
import type { StageSummary } from "./types";
import { TrackName } from "./track-name";
import styles from "./catalog.module.css";

function StageIdentity({ stage, selected }: { stage: StageSummary; selected: boolean }): ReactNode {
  return (
    <div className={styles.bookCell} data-selected={selected || undefined}>
      <div>
        <strong>{stage.name}</strong>
        <span>
          {stage.internalCode} ·{" "}
          {stage.bookLessonCount === null
            ? "Lições não informadas"
            : `${stage.bookLessonCount} lições`}
        </span>
      </div>
    </div>
  );
}

export function StageCatalogList({
  state,
  selectedId,
  onSelect,
  onRetry,
  footer,
}: {
  state: DataTableState<StageSummary>;
  selectedId: string | null;
  onSelect: (stage: StageSummary) => void;
  onRetry: () => void;
  footer: ReactNode;
}): ReactNode {
  if (state.kind !== "data") {
    return (
      <DataTable<StageSummary>
        label="Estágios"
        columns={[
          {
            id: "stage",
            header: "Estágio",
            width: "wide",
            cell: (stage) => <StageIdentity stage={stage} selected={stage.id === selectedId} />,
          },
        ]}
        state={state}
        empty={{
          title: "Nenhum estágio disponível",
          description: "Os estágios serão disponibilizados pelo catálogo da escola.",
        }}
        errorTitle="Não foi possível carregar os estágios"
        onRetry={onRetry}
        footer={footer}
      />
    );
  }
  return (
    <GroupedCatalog rows={state.rows} selectedId={selectedId} onSelect={onSelect} footer={footer} />
  );
}

function GroupedCatalog({
  rows,
  selectedId,
  onSelect,
  footer,
}: {
  rows: readonly StageSummary[];
  selectedId: string | null;
  onSelect: (stage: StageSummary) => void;
  footer: ReactNode;
}): ReactNode {
  const groups = groupStages(rows);
  return (
    <TableContainer viewportBound footer={footer}>
      {Array.from(groups.values(), ({ track, stages }) => (
        <Table key={track.id} aria-labelledby={`track-${track.id}`} className="min-w-0 table-fixed">
          <TableHeader sticky>
            <TableRow interactive={false}>
              <TableHead>
                <div className={styles.trackHeading}>
                  <h2 id={`track-${track.id}`}>
                    <TrackName track={track} />
                  </h2>
                  <span>{track.ageGroup === "CHILD" ? "Infantil" : "Adulto"}</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((stage) => (
              <StageRow
                key={stage.id}
                stage={stage}
                selected={stage.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </TableBody>
        </Table>
      ))}
    </TableContainer>
  );
}

function groupStages(
  rows: readonly StageSummary[],
): Map<string, { track: StageSummary["track"]; stages: StageSummary[] }> {
  // Preserve the catalog's track order and each track's stage progression.
  const groups = new Map<string, { track: StageSummary["track"]; stages: StageSummary[] }>();
  for (const stage of rows) {
    const group = groups.get(stage.track.id);
    if (group) group.stages.push(stage);
    else groups.set(stage.track.id, { track: stage.track, stages: [stage] });
  }

  return groups;
}

function StageRow({
  stage,
  selected,
  onSelect,
}: {
  stage: StageSummary;
  selected: boolean;
  onSelect: (stage: StageSummary) => void;
}): ReactNode {
  return (
    <TableRow
      selected={selected}
      tabIndex={0}
      onClick={() => onSelect(stage)}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        onSelect(stage);
      }}
    >
      <TableCell>
        <StageIdentity stage={stage} selected={selected} />
      </TableCell>
    </TableRow>
  );
}
