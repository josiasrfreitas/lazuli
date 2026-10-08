import type { ReactElement } from "react";
import { Cake, MoreHorizontal, Phone, UsersRound } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
  PopoverTitle,
  Pagination,
  cn,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { toWhatsAppUrl } from "~/lib/format";
import { rosterStatus, type RosterRow } from "./roster-status";
import { studentAgeLabel } from "./student-age";
import { formatTrackName } from "./labels";

type List = RouterOutputs["classes"]["roster"];
const tones = {
  Vigente: "success",
  Programada: "info",
  Pausada: "warning",
  Encerrada: "neutral",
  "Aguardando execução": "warning",
} as const;
export function RosterStudent({
  row,
  today,
  close,
  showStage = true,
}: {
  row: RosterRow;
  today: string;
  close: (row: RosterRow) => void;
  showStage?: boolean;
}): ReactElement {
  const status = rosterStatus(row, today) as keyof typeof tones;
  const whatsAppUrl = toWhatsAppUrl(row.student.phone);
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border border-border/60 bg-card p-4",
        !showStage && "gap-2 py-3",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={row.student.fullName} colorKey={row.studentId} />
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-body font-medium"
            title={row.student.fullName}
            aria-label={row.student.fullName}
          >
            {row.student.fullName.trim().split(/\s+/u).slice(0, 2).join(" ")}
          </h3>
        </div>
      </div>
      {showStage && <StudentLearningContext row={row} />}
      {status !== "Vigente" && (
        <div>
          <Badge variant={tones[status]}>{status}</Badge>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-1 text-caption text-muted-foreground">
          <p className="flex items-center gap-2">
            <Cake aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{studentAgeLabel(row.student.birthDate, today)}</span>
          </p>
          <p className="flex min-w-0 items-center gap-2">
            <Phone aria-hidden="true" className="size-3.5 shrink-0" />
            {whatsAppUrl ? (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir WhatsApp de ${row.student.fullName}`}
                className="break-words rounded-sm font-numeric tabular-nums text-interactive underline-offset-4 hover:text-interactive-hover hover:underline focus-visible:outline-none focus-visible:shadow-focus"
              >
                {row.student.phone}
              </a>
            ) : (
              <span>Sem telefone</span>
            )}
          </p>
        </div>
        <StudentActions row={row} close={close} canClose={status === "Vigente"} />
      </div>
    </li>
  );
}

function StudentLearningContext({ row }: { row: RosterRow }): ReactElement {
  const stage = row.progressRecords[0]?.stage;
  return (
    <dl className="space-y-1 text-caption">
      <div className="flex flex-wrap gap-x-1.5">
        <dt className="text-muted-foreground">Trilha</dt>
        <dd className="min-w-0 break-words">
          {stage ? formatTrackName(stage.track.name) : "Não informada"}
        </dd>
      </div>
      <div className="flex flex-wrap gap-x-1.5">
        <dt className="text-muted-foreground">Estágio</dt>
        <dd className="min-w-0 break-words">{stage?.name ?? "Não informado"}</dd>
      </div>
    </dl>
  );
}

function StudentMembershipDates({ row }: { row: RosterRow }): ReactElement {
  return (
    <>
      {row.exitDate && (
        <p className="mt-1 text-caption text-muted-foreground">
          Saída em {row.exitDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
      )}
      {row.actions[0] && (
        <p className="mt-1 text-caption text-muted-foreground">
          {row.actions[0].kind === "PAUSE" ? "Pausa" : "Saída"} em{" "}
          {row.actions[0].effectiveDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
      )}
    </>
  );
}

export function RosterList({
  data,
  failed,
  refetch,
  page,
  setPage,
  close,
  showStage,
}: {
  data: List | undefined;
  failed: boolean;
  refetch: () => void;
  page: number;
  setPage: (page: number) => void;
  close: (row: RosterRow) => void;
  showStage: boolean;
}): ReactElement {
  if (failed) return <RosterError refetch={refetch} />;
  if (!data)
    return (
      <p role="status" className="p-5 text-muted-foreground">
        Carregando alunos…
      </p>
    );
  return (
    <div className="relative flex min-h-0 max-h-128 flex-col lg:max-h-none lg:flex-1">
      {data.rows.length === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title="Nenhum vínculo encontrado"
          description="Ajuste a busca ou matricule um aluno."
        />
      ) : (
        <div
          role="region"
          aria-label="Lista de alunos"
          tabIndex={0}
          className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl focus-visible:outline-none focus-visible:shadow-focus"
        >
          <ul
            aria-label="Alunos da turma"
            className="grid content-start gap-3 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @7xl:grid-cols-5"
          >
            {data.rows.map((row) => (
              <RosterStudent
                key={row.id}
                row={row}
                today={data.today}
                close={close}
                showStage={showStage}
              />
            ))}
          </ul>
        </div>
      )}
      <RosterPagination data={data} page={page} setPage={setPage} />
    </div>
  );
}

function StudentActions({
  row,
  close,
  canClose,
}: {
  row: RosterRow;
  close: (row: RosterRow) => void;
  canClose: boolean;
}): ReactElement {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Detalhes de ${row.student.fullName}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end">
        <PopoverTitle>{row.student.fullName}</PopoverTitle>
        <p className="mt-2 text-caption text-muted-foreground">
          Entrada em {row.entryDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
        <StudentMembershipDates row={row} />
        {canClose && (
          <div className="mt-3">
            <PopoverClose
              render={<Button size="sm" variant="secondary" onClick={() => close(row)} />}
            >
              Pausar ou encerrar vínculo
            </PopoverClose>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RosterPagination({
  data,
  page,
  setPage,
}: {
  data: List;
  page: number;
  setPage: (page: number) => void;
}): ReactElement | null {
  if (data.pageCount <= 1) return null;
  return (
    <div className="absolute bottom-2 right-3 z-10 w-fit rounded-full bg-background/85 px-2 py-1 shadow-sm ring-1 ring-border/60 backdrop-blur-sm">
      <Pagination
        label="Páginas de alunos"
        page={page}
        pageCount={data.pageCount}
        onPageChange={setPage}
      />
    </div>
  );
}

function RosterError({ refetch }: { refetch: () => void }): ReactElement {
  return (
    <EmptyState
      role="alert"
      title="Não foi possível carregar os alunos"
      action={
        <Button size="sm" variant="secondary" onClick={refetch}>
          Tentar novamente
        </Button>
      }
    />
  );
}
