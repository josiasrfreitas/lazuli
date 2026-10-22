"use client";

import { useState, type ReactElement } from "react";
import { ClassRecordTrigger } from "~/features/class-records/class-record-trigger";
import { ListChecks } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DataTableColumn,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";

type Props = { classId: string; className: string; personalized: boolean };
type Lesson = RouterOutputs["classRecords"]["progress"]["rows"][number];
const PAGE_SIZE = 25;
const STATES = {
  RECORDED: "Registrada",
  PENDING: "Sem registro",
  CANCELLED: "Cancelada",
  UPCOMING: "Agendada",
} as const;

export function ClassLessonsDialog(props: Props): ReactElement {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="link" size="inline" />}>
        <ListChecks aria-hidden="true" />
        Ver aulas da turma
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Aulas da turma</DialogTitle>
            <DialogDescription>
              {props.className} · Conteúdo e páginas trabalhadas
            </DialogDescription>
          </DialogHeader>
          <ClassLessonsContent {...props} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function ClassLessonsContent({ classId, personalized }: Props): ReactElement {
  const [page, setPage] = useState(1);
  const query = trpc.classRecords.progress.useQuery({ classId });
  const data = query.data;
  const total = data?.rows.length ?? 0;
  return (
    <DialogBody className="flex flex-col">
      <div className="flex min-h-0 min-w-0 flex-col gap-4 pt-4">
        <p className="text-caption text-muted-foreground">
          {personalized
            ? "Os percursos desta turma são individuais. Abra a aula para consultar o conteúdo de cada aluno."
            : "Páginas trabalhadas em cada aula, conforme o registro do professor."}
          {data && ` Aulas até ${formatDateOnlyBR(data.today)}, mais recentes primeiro.`}
        </p>
        <DataTable
          label="Aulas e progresso da turma"
          columns={lessonColumns(personalized)}
          state={lessonTableState({ error: query.isError, rows: data?.rows, page })}
          onRetry={() => void query.refetch()}
          errorTitle="Não foi possível carregar as aulas"
          empty={{
            title: "Nenhuma aula neste período",
            description: "As aulas da turma aparecem aqui conforme o calendário avança.",
          }}
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            totalItems: total,
            onPageChange: setPage,
            itemLabel: { singular: "aula", plural: "aulas" },
          }}
        />
      </div>
    </DialogBody>
  );
}

function lessonTableState({
  error,
  rows,
  page,
}: {
  error: boolean;
  rows: Lesson[] | undefined;
  page: number;
}): { kind: "error" } | { kind: "empty" } | { kind: "loading" } | { kind: "data"; rows: Lesson[] } {
  if (error) return { kind: "error" };
  if (!rows) return { kind: "loading" };
  if (rows.length === 0) return { kind: "empty" };
  return { kind: "data", rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

function lessonColumns(personalized: boolean): DataTableColumn<Lesson>[] {
  return [
    {
      id: "date",
      header: "Aula",
      width: "medium",
      cell: (row) => (
        <div className="grid gap-1">
          <ClassRecordTrigger
            sessionId={row.id}
            label={`Ver aula de ${formatDateOnlyBR(row.date)}`}
          >
            {formatDateOnlyBR(row.date)}
          </ClassRecordTrigger>
          <span className="text-caption text-muted-foreground">
            {row.startTime}–{row.endTime}
          </span>
        </div>
      ),
    },
    {
      id: "pages",
      header: "Páginas trabalhadas",
      width: "medium",
      cell: (row) => lessonPages(row, personalized),
    },
    {
      id: "content",
      header: "Conteúdo da aula",
      width: "wide",
      cell: (row) => lessonContent(row, personalized),
    },
    {
      id: "status",
      header: "Registro",
      width: "standard",
      cell: (row) => (
        <Badge variant={row.state === "RECORDED" ? "success" : "neutral"}>
          {STATES[row.state]}
        </Badge>
      ),
    },
  ];
}

function lessonPages(row: Lesson, personalized: boolean): ReactElement {
  const content = row.content;
  const pageFrom = content?.pageFrom;
  if (!content || typeof pageFrom !== "number") {
    let label = "Não informadas";
    if (row.state === "CANCELLED" || row.state === "UPCOMING") label = "—";
    else if (personalized) label = "Por aluno";
    return <span className="text-caption text-muted-foreground">{label}</span>;
  }
  const pageTo = content.pageTo;
  const pageRange = typeof pageTo === "number" && pageTo !== pageFrom ? `–${pageTo}` : "";
  return (
    <span className="font-medium text-heading">
      Pág. {content.pageFrom}
      {pageRange}
    </span>
  );
}

function lessonContent(row: Lesson, personalized: boolean): ReactElement {
  const fallback =
    personalized && row.state === "RECORDED" ? "Consulte os registros individuais na aula." : "—";
  return (
    <div className="grid gap-1">
      {row.content?.reference && <span className="font-medium">{row.content.reference}</span>}
      <p className="whitespace-pre-line break-words text-caption text-muted-foreground">
        {row.content?.account ?? fallback}
      </p>
    </div>
  );
}
