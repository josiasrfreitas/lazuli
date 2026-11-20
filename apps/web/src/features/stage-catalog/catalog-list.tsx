import { useState } from "react";
import Link from "next/link";
import { TEACHING_HOUR_MINUTES } from "@lazuli/domain";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  type LucideIcon,
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
import styles from "./catalog.module.css";

export function ActionsMenu({
  name,
  actions,
}: {
  name: string;
  actions: { label: string; icon: LucideIcon; onClick: () => void }[];
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
          {actions.map(({ label, icon: Icon, onClick }) => (
            <Button
              key={label}
              className="justify-end"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                onClick();
              }}
            >
              {label}
              <Icon aria-hidden="true" />
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
  item,
  target,
  move,
  pending,
}: {
  list: { id: string }[];
  item: { id: string; name: string };
  target: "track" | "stage";
  move: Move;
  pending: boolean;
}): React.JSX.Element {
  const index = list.findIndex((entry) => entry.id === item.id);
  return (
    <div className="flex justify-end">
      {(["up", "down"] as const).map((direction) => {
        const neighbor = list[index + (direction === "up" ? -1 : 1)];
        const label = "Mover " + item.name + (direction === "up" ? " para cima" : " para baixo");
        return (
          <Button
            key={direction}
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!neighbor || pending}
            aria-label={label}
            title={label}
            onClick={() =>
              neighbor && move({ target, id: item.id, neighborId: neighbor.id, direction })
            }
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
  // Keep the table semantics when narrow rows switch to a two-line CSS grid.
  return (
    <Table
      role="table"
      className="min-w-0"
      density="compact"
      aria-label={"Estágios de " + track.name}
      data-reordering={props.reorder || undefined}
    >
      <colgroup>
        <col />
        <col />
        <col />
      </colgroup>
      <TableHeader className="sr-only">
        <TableRow interactive={false}>
          <TableHead>Estágio</TableHead>
          <TableHead>Programação, turmas e alunos</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody role="rowgroup">
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
    <TableRow role="row" interactive={false}>
      <TableCell role="cell">
        <StageIdentity
          stage={stage}
          href={href(stage.id, track.id)}
          legacy={legacy || stage.status === "LEGACY"}
        />
      </TableCell>
      <TableCell role="cell">
        <div className={styles.stageOverview}>
          <ProgramSummary programs={stage.teachingPrograms} />
          <span className={styles.stageUsage}>
            <span>
              <span className={styles.quantity}>{stage.classCount}</span>{" "}
              {stage.classCount === 1 ? "turma" : "turmas"}
            </span>
            <span>
              <span className={styles.quantity}>{stage.studentCount}</span>{" "}
              {stage.studentCount === 1 ? "aluno" : "alunos"}
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell role="cell">
        {reorder ? (
          <OrderButtons
            target="stage"
            list={track.stages}
            item={stage}
            move={move}
            pending={pending}
          />
        ) : (
          <ActionsMenu
            name={stage.name}
            actions={[
              {
                label: "Editar identificação",
                icon: Pencil,
                onClick: () => open({ action: "editStage", ...stage }),
              },
              ...(!legacy && stage.status === "ACTIVE"
                ? [
                    {
                      label: "Marcar como Legacy",
                      icon: Archive,
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

function StageIdentity({
  stage,
  href,
  legacy,
}: {
  stage: Stage;
  href: string;
  legacy: boolean;
}): React.JSX.Element {
  const nameId = "stage-name-" + stage.id;
  const metaId = "stage-meta-" + stage.id;
  return (
    <Link
      id={"stage-" + stage.id}
      href={href}
      className={styles.stageLink}
      aria-labelledby={nameId}
      aria-describedby={legacy ? metaId + " " + nameId + "-status" : metaId}
    >
      <span className={styles.ordinal}>{stage.sequence.toString().padStart(2, "0")}</span>
      <span className={styles.stageIdentity}>
        <span className={styles.stageName}>
          <span id={nameId}>{stage.name}</span>
          {legacy && (
            <Badge id={nameId + "-status"} variant="neutral">
              Legacy
            </Badge>
          )}
        </span>
        <span className={styles.stageMeta} id={metaId}>
          {stage.internalCode} ·{" "}
          {stage.bookLessonCount === null
            ? "Lições não informadas"
            : stage.bookLessonCount + (stage.bookLessonCount === 1 ? " lição" : " lições")}
        </span>
      </span>
    </Link>
  );
}

function ProgramSummary({ programs }: { programs: Stage["teachingPrograms"] }): React.JSX.Element {
  if (programs.length === 0) return <span className={styles.stageMeta}>Sem programação</span>;
  return (
    <ul className={styles.stagePrograms}>
      {programs.map((program) => {
        const mode = program.scheduleType === "REGULAR" ? "Regular" : "PPT";
        const hasOtherLoads = programs.some(
          (other) =>
            other.scheduleType === program.scheduleType &&
            other.modality.weeklyMinutes !== program.modality.weeklyMinutes,
        );
        const weeklyHours = program.modality.weeklyMinutes / TEACHING_HOUR_MINUTES;
        return (
          <li key={program.id}>
            {mode} <span className={styles.hours}>{program._count.teachingHours} h</span>
            {hasOtherLoads && (
              <span className={styles.weeklyLoad}>
                {" "}
                · {weeklyHours.toLocaleString("pt-BR")} h/sem.
              </span>
            )}
          </li>
        );
      })}
    </ul>
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
  const nameId = "track-name-" + track.id;
  const factsId = "track-facts-" + track.id;
  return (
    <header className={styles.trackHead} data-expanded={expanded || undefined}>
      <h2 className={styles.trackHeading}>
        <button
          type="button"
          className={styles.trackToggle}
          onClick={toggle}
          aria-labelledby={nameId}
          aria-describedby={legacy ? factsId + " " + nameId + "-status" : factsId}
          aria-expanded={expanded}
          aria-controls={expanded ? "stages-" + track.id : undefined}
        >
          {expanded ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
          <span className={styles.trackIdentity}>
            <span className={styles.trackName}>
              <span id={nameId}>{track.name}</span>
              {legacy && (
                <Badge id={nameId + "-status"} variant="neutral">
                  Legacy
                </Badge>
              )}
            </span>
            <span className={styles.trackFacts} id={factsId}>
              <span>
                {track.productLine.name} ·{" "}
                {track.ageGroup === "CHILD" ? "Público infantil" : "Público adulto"}
              </span>
              <span className={styles.count}>
                <span className={styles.quantity}>{track.stages.length}</span>{" "}
                {track.stages.length === 1 ? "estágio" : "estágios"}
              </span>
            </span>
          </span>
        </button>
      </h2>
      {reorder ? (
        <OrderButtons target="track" list={tracks} item={track} move={move} pending={pending} />
      ) : (
        <ActionsMenu
          name={track.name}
          actions={
            legacy
              ? []
              : [
                  { label: "Adicionar estágio", icon: Plus, onClick: add },
                  {
                    label: "Marcar como Legacy",
                    icon: Archive,
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
