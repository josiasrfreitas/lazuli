import type { ReactElement } from "react";
import { MoreHorizontal, Phone, UsersRound } from "lucide-react";
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
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
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
}: RosterStudentInput): ReactElement {
  const status = rosterStatus(row, today) as keyof typeof tones;
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        <Avatar name={row.student.fullName} colorKey={row.studentId} />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-body font-medium">{row.student.fullName}</h3>
          <p className="mt-1 text-caption text-muted-foreground">
            {studentAgeLabel(row.student.birthDate, today)}
          </p>
        </div>
      </div>
      {showStage && <StudentLearningContext row={row} />}
      {status !== "Vigente" && (
        <div>
          <Badge variant={tones[status]}>{status}</Badge>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
          <Phone aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="break-words font-numeric tabular-nums">
            {row.student.phone ?? "Sem telefone"}
          </span>
        </p>
        <StudentActions row={row} close={close} canClose={status === "Vigente"} />
      </div>
    </li>
  );
}

function StudentLearningContext({ row }: StudentLearningContextInput): ReactElement {
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

function StudentMembershipDates({ row }: StudentMembershipDatesInput): ReactElement {
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
}: RosterListInput): ReactElement {
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
        <EmptyRoster />
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

function StudentActions({ row, close, canClose }: StudentActionsInput): ReactElement {
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

function RosterPagination({ data, page, setPage }: RosterPaginationInput): ReactElement | null {
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

function RosterError({ refetch }: RosterErrorInput): ReactElement {
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

type RosterStudentInput = {
  row: RosterRow;
  today: string;
  close: (row: RosterRow) => void;
  showStage?: boolean;
};
type StudentLearningContextInput = { row: RosterRow };
type StudentMembershipDatesInput = { row: RosterRow };
type RosterListInput = {
  data: List | undefined;
  failed: boolean;
  refetch: () => void;
  page: number;
  setPage: (page: number) => void;
  close: (row: RosterRow) => void;
  showStage: boolean;
};
type StudentActionsInput = {
  row: RosterRow;
  close: (row: RosterRow) => void;
  canClose: boolean;
};
type RosterPaginationInput = {
  data: List;
  page: number;
  setPage: (page: number) => void;
};
type RosterErrorInput = { refetch: () => void };

function EmptyRoster(): ReactElement {
  return (
    <EmptyState
      icon={<UsersRound />}
      title="Nenhum vínculo encontrado"
      description="Ajuste a busca ou matricule um aluno."
    />
  );
}
