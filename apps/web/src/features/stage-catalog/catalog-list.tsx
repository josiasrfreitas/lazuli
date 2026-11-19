import { useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lazuli/ui";
import type { Stage, Track } from "./types";
import type { CatalogDialogState } from "./catalog-dialog";
import styles from "./workspace.module.css";

export function ActionsMenu({
  name,
  actions,
}: {
  name: string;
  actions: { label: string; onClick: () => void }[];
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={"Ações de " + name} />}
      >
        <MoreHorizontal />
      </PopoverTrigger>
      <PopoverContent size="menu" align="end" showArrow={false}>
        <div className="grid">
          {actions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
type Move = (command: {
  target: "track" | "stage";
  id: string;
  neighborId: string;
  direction: "up" | "down";
}) => void;
function OrderButtons({
  list,
  id,
  target,
  move,
  pending,
}: {
  list: { id: string }[];
  id: string;
  target: "track" | "stage";
  move: Move;
  pending: boolean;
}): React.JSX.Element {
  const index = list.findIndex((item) => item.id === id);
  return (
    <div className="flex">
      {(["up", "down"] as const).map((direction) => {
        const neighbor = list[index + (direction === "up" ? -1 : 1)];
        const label = direction === "up" ? "Mover para cima" : "Mover para baixo";
        return (
          <Button
            key={direction}
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!neighbor || pending}
            aria-label={label}
            title={label}
            onClick={() => neighbor && move({ target, id, neighborId: neighbor.id, direction })}
          >
            {direction === "up" ? <ArrowUp /> : <ArrowDown />}
          </Button>
        );
      })}
    </div>
  );
}
type Props = {
  track: Track;
  tracks: Track[];
  expanded: boolean;
  filtered: boolean;
  toggle: () => void;
  reorder: boolean;
  pending: boolean;
  move: Move;
  open: (item: CatalogDialogState) => void;
  href: (id: string, trackId: string) => string;
};
export function CatalogTrack({
  track,
  tracks,
  expanded: selected,
  filtered,
  toggle: toggleTrack,
  reorder,
  pending,
  move,
  open,
  href,
}: Props): React.JSX.Element {
  const [folded, setFolded] = useState(false);
  const expanded = filtered ? !folded : selected;
  const toggle = (): void => {
    if (filtered) setFolded(!folded);
    else toggleTrack();
  };
  const legacy = track.status === "LEGACY";
  const add = (): void => open({ action: "createStage", trackId: track.id, trackName: track.name });
  return (
    <section className={styles.track} aria-label={track.name} id={"track-" + track.id}>
      <TrackHeading
        track={track}
        tracks={tracks}
        expanded={expanded}
        toggle={toggle}
        reorder={reorder}
        legacy={legacy}
        pending={pending}
        move={move}
        add={add}
        open={open}
      />
      {expanded && (
        <div id={"stages-" + track.id} className={styles.trackBody}>
          {track.stages.length > 0 ? (
            <StageTable
              track={track}
              reorder={reorder}
              pending={pending}
              move={move}
              open={open}
              href={href}
            />
          ) : (
            <p className={styles.emptyLine}>
              {legacy ? <Archive aria-hidden="true" size={15} /> : null}Nenhum estágio nesta track.
            </p>
          )}
          {!legacy && !reorder && (
            <Button
              type="button"
              size="sm"
              variant={track.stages.length > 0 ? "text" : "primary"}
              onClick={add}
            >
              <Plus />
              Adicionar estágio
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

type StageTableProps = Pick<Props, "track" | "reorder" | "pending" | "move" | "open" | "href">;
function StageTable(props: StageTableProps): React.JSX.Element {
  const { track } = props;
  return (
    <Table className="min-w-0" aria-label={"Estágios de " + track.name}>
      <TableHeader>
        <TableRow interactive={false}>
          <TableHead>Estágio</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Lições</TableHead>
          <TableHead>
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {track.stages.map((stage) => (
          <StageRow key={stage.id} {...props} stage={stage} />
        ))}
      </TableBody>
    </Table>
  );
}
function StageRow({
  track,
  stage,
  reorder,
  move,
  pending,
  open,
  href,
}: StageTableProps & { stage: Stage }): React.JSX.Element {
  const legacy = track.status === "LEGACY";
  return (
    <TableRow interactive={false}>
      <TableCell>
        <div className={styles.stageCell}>
          <span className={styles.ordinal}>{stage.sequence.toString().padStart(2, "0")}</span>
          <Link id={"stage-" + stage.id} href={href(stage.id, track.id)}>
            {stage.name}
          </Link>
          {(legacy || stage.status === "LEGACY") && <Badge variant="neutral">Legacy</Badge>}
        </div>
      </TableCell>
      <TableCell>{stage.internalCode}</TableCell>
      <TableCell>{stage.bookLessonCount ?? "—"}</TableCell>
      <TableCell>
        {reorder ? (
          <OrderButtons
            target="stage"
            list={track.stages}
            id={stage.id}
            move={move}
            pending={pending}
          />
        ) : (
          <ActionsMenu
            name={stage.name}
            actions={[
              {
                label: "Editar identificação",
                onClick: () => open({ action: "editStage", ...stage }),
              },
              ...(!legacy && stage.status === "ACTIVE"
                ? [
                    {
                      label: "Marcar como Legacy",
                      onClick: () =>
                        open({
                          action: "legacy",
                          target: "stage",
                          id: stage.id,
                          name: stage.name,
                        }),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

function TrackHeading({
  track,
  tracks,
  expanded,
  toggle,
  reorder,
  legacy,
  pending,
  move,
  add,
  open,
}: Omit<Props, "filtered" | "href"> & { legacy: boolean; add: () => void }): React.JSX.Element {
  return (
    <header className={styles.trackHead}>
      <button
        type="button"
        className={styles.trackToggle}
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={"stages-" + track.id}
      >
        {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        <span>
          <strong>{track.name}</strong>
          <small>
            {track.productLine.name} ·{" "}
            {track.ageGroup === "CHILD" ? "Público infantil" : "Público adulto"}
          </small>
        </span>
      </button>
      {legacy && <Badge variant="neutral">Legacy</Badge>}
      <span className={styles.count}>
        {track.stages.length} {track.stages.length === 1 ? "estágio" : "estágios"}
      </span>
      {reorder ? (
        <OrderButtons target="track" list={tracks} id={track.id} move={move} pending={pending} />
      ) : (
        <ActionsMenu
          name={track.name}
          actions={
            legacy
              ? []
              : [
                  { label: "Adicionar estágio", onClick: add },
                  {
                    label: "Marcar como Legacy",
                    onClick: () =>
                      open({ action: "legacy", target: "track", id: track.id, name: track.name }),
                  },
                ]
          }
        />
      )}
    </header>
  );
}
