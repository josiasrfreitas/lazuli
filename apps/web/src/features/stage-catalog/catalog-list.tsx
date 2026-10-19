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

function StageIdentity({ stage, selected }: { stage: StageSummary; selected: boolean }) {
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
}) {
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
        loadingRows={7}
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

  // Preserve the catalog's track order and each track's stage progression.
  const groups = new Map<string, { track: StageSummary["track"]; stages: StageSummary[] }>();
  for (const stage of state.rows) {
    const group = groups.get(stage.track.id);
    if (group) group.stages.push(stage);
    else groups.set(stage.track.id, { track: stage.track, stages: [stage] });
  }

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
              <TableRow
                key={stage.id}
                selected={stage.id === selectedId}
                tabIndex={0}
                className="cursor-pointer data-[selected]:outline data-[selected]:outline-1 data-[selected]:-outline-offset-1 data-[selected]:outline-border-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                onClick={() => onSelect(stage)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  onSelect(stage);
                }}
              >
                <TableCell>
                  <StageIdentity stage={stage} selected={stage.id === selectedId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ))}
    </TableContainer>
  );
}
