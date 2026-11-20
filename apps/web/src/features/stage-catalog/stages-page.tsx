"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpDown, Check, Plus, Search } from "lucide-react";
import {
  Button,
  Checkbox,
  DetailHeader,
  EmptyState,
  Input,
  Field,
  Label,
  TableContainer,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { CatalogDialog, type CatalogDialogState } from "./catalog-dialog";
import { CatalogTrack } from "./catalog-list";
import type { Directory, Track } from "./types";
import { StageLoading } from "./loading";
import styles from "./catalog.module.css";
import workspace from "./workspace.module.css";

export function StagesPage(): React.JSX.Element {
  const params = useSearchParams();
  const query = trpc.teachingPrograms.directory.useQuery();
  const mutation = trpc.teachingPrograms.editCatalog.useMutation();
  const [dialog, setDialog] = useState<CatalogDialogState | null>(null);
  const [order, setOrder] = useState(false);
  const [notice, setNotice] = useState("");
  const search = params.get("busca") ?? "",
    legacy = params.get("legacy") === "1";
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const tracks = filteredTracks(query.data?.tracks ?? [], { term, legacy });
  const expanded = params.get("track") ?? tracks[0]?.id;
  const data = query.data;
  return (
    <section aria-label="Catálogo de estágios" className={workspace.scroll}>
      <div className={styles.page}>
        <CatalogHeader data={data} tracks={tracks} open={setDialog} />
        <TableContainer>
          <CatalogToolbar search={search} legacy={legacy} order={order} setOrder={setOrder} />
          <span role="status" className="sr-only">
            {notice}
          </span>
          {mutation.error && <p role="alert">{mutation.error.message}</p>}
          <CatalogResults
            pending={query.isPending}
            error={query.isError}
            retry={() => void query.refetch()}
            empty={tracks.length === 0}
            term={term}
          >
            <div>
              {tracks.map((track) => (
                <CatalogTrack
                  key={term + "-" + track.id}
                  track={track}
                  tracks={tracks}
                  filtered={term.length > 0}
                  expanded={expanded === track.id}
                  toggle={() => change({ track: expanded === track.id ? "fechada" : track.id })}
                  reorder={order}
                  pending={mutation.isPending}
                  open={setDialog}
                  href={(id, trackId) => stageLink(params, { id, trackId })}
                  move={(command) =>
                    mutation.mutate(
                      { action: "move", ...command, showLegacy: legacy },
                      {
                        onSettled: () => {
                          void query.refetch();
                        },
                        onSuccess: () => setNotice("Ordem atualizada."),
                      },
                    )
                  }
                />
              ))}
            </div>
          </CatalogResults>
        </TableContainer>
        {dialog && (
          <CatalogDialog
            item={dialog}
            onClose={() => setDialog(null)}
            afterSave={(id) => {
              setNotice("Catálogo atualizado.");
              focusCatalogCreation(dialog, id);
            }}
          />
        )}
      </div>
    </section>
  );
}

function change(values: Record<string, string>): void {
  const next = new URLSearchParams(globalThis.location.search);
  for (const [key, value] of Object.entries(values)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  globalThis.history.replaceState(
    null,
    "",
    next.size > 0 ? "/estagios?" + next.toString() : "/estagios",
  );
}

function filteredTracks(
  rows: Track[],
  { term, legacy }: { term: string; legacy: boolean },
): Track[] {
  return rows
    .filter((track) => legacy || track.status !== "LEGACY")
    .flatMap((track) => {
      const match = track.name.toLocaleLowerCase("pt-BR").includes(term);
      const stages = track.stages.filter(
        (stage) =>
          (legacy || stage.status !== "LEGACY") &&
          (match ||
            (stage.name + " " + stage.internalCode).toLocaleLowerCase("pt-BR").includes(term)),
      );
      return match || stages.length > 0 ? [{ ...track, stages }] : [];
    });
}
function CatalogHeader({
  data,
  tracks,
  open,
}: {
  data: Directory | undefined;
  tracks: Track[];
  open: (item: CatalogDialogState) => void;
}): React.JSX.Element {
  const stageCount = tracks.reduce((sum, track) => sum + track.stages.length, 0);
  return (
    <DetailHeader
      title="Estágios"
      metadataPlacement="below"
      metadata={
        data && (
          <span className={workspace.meta}>
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"} · {stageCount}{" "}
            {stageCount === 1 ? "estágio" : "estágios"}
          </span>
        )
      }
      actions={
        <Button
          size="sm"
          disabled={!data?.productLines.length}
          onClick={() => data && open({ action: "createTrack", lines: data.productLines })}
        >
          <Plus />
          Nova track
        </Button>
      }
    />
  );
}
function CatalogToolbar({
  search,
  legacy,
  order,
  setOrder,
}: {
  search: string;
  legacy: boolean;
  order: boolean;
  setOrder: (next: boolean) => void;
}): React.JSX.Element {
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <Input
          size="sm"
          leadingIcon={<Search />}
          name="busca"
          aria-label="Buscar track, estágio ou código"
          placeholder="Buscar track, estágio ou código…"
          autoComplete="off"
          value={search}
          onChange={(event) => {
            setOrder(false);
            change({ busca: event.target.value });
          }}
        />
      </div>
      <Field className="w-auto">
        <Label>
          <span className={styles.legacyLabel}>
            <Checkbox
              checked={legacy}
              onCheckedChange={(value) => change({ legacy: value ? "1" : "" })}
            />
            Mostrar Legacy
          </span>
        </Label>
      </Field>
      <Button
        variant={order ? "secondary" : "ghost"}
        size="sm"
        disabled={search.trim().length > 0}
        aria-pressed={order}
        onClick={() => setOrder(!order)}
      >
        {order ? <Check /> : <ArrowUpDown />}
        {order ? "Concluir ordem" : "Reordenar"}
      </Button>
    </div>
  );
}
function CatalogResults({
  pending,
  error,
  retry,
  empty,
  term,
  children,
}: {
  pending: boolean;
  error: boolean;
  retry: () => void;
  empty: boolean;
  term: string;
  children: React.ReactNode;
}): React.ReactNode {
  if (pending) return <StageLoading />;
  if (error)
    return (
      <EmptyState
        title="Não foi possível carregar o catálogo"
        action={<Button onClick={retry}>Tentar novamente</Button>}
      />
    );
  if (empty)
    return (
      <EmptyState
        title={term ? "Nenhum resultado" : "Nenhuma track disponível"}
        action={
          term ? (
            <Button variant="secondary" onClick={() => change({ busca: "" })}>
              Limpar busca
            </Button>
          ) : undefined
        }
      />
    );
  return children;
}

function focusCatalogCreation(dialog: CatalogDialogState, id: string): void {
  if (dialog.action !== "createTrack" && dialog.action !== "createStage") return;
  const trackId = dialog.action === "createTrack" ? id : dialog.trackId;
  change({ track: trackId, busca: "" });
  const target =
    dialog.action === "createTrack"
      ? "#track-" + CSS.escape(id) + " header button"
      : "#stage-" + CSS.escape(id);
  requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(target);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: "nearest" });
  });
}

function stageLink(
  params: URLSearchParams,
  { id, trackId }: { id: string; trackId: string },
): string {
  const list = new URLSearchParams(params);
  list.set("track", trackId);
  return (
    "/estagios/" +
    id +
    "?" +
    new URLSearchParams({ voltar: "/estagios?" + list.toString() }).toString()
  );
}
