"use client";
import type { RouterOutputs } from "@lazuli/api";
import { type ReactElement, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Clock3, Users } from "lucide-react";
import { Alert, Badge, Button, EmptyState, InlineSkeleton, Pagination } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { formatClassScheduleTime, formatFormat, formatTrackName } from "../classes/labels";

export function TeacherClasses({ teacherId, back }: TeacherClassesInput): ReactElement {
  const [page, setPage] = useState(1);
  const query = trpc.teachers.classes.useQuery({ id: teacherId, page, pageSize: 10 });
  return (
    <section className="grid gap-3 border-t border-border pt-5" aria-label="Turmas vinculadas">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3 font-semibold">
          Turmas vinculadas{query.data ? ` · ${query.data.total}` : ""}
        </h2>
        <p className="text-caption text-muted-foreground">
          Vínculos atuais, programados e históricos
        </p>
      </div>
      <TeacherClassResults query={query} back={back} onPageChange={setPage} />
    </section>
  );
}

type TeacherClassCardProps = {
  row: RouterOutputs["teachers"]["classes"]["rows"][number];
  back: string;
};
function TeacherClassCard(props: TeacherClassCardProps): ReactElement {
  return (
    <li key={props.row.id}>
      <Link
        href={`/turmas/${props.row.id}?voltar=${encodeURIComponent(props.back)}`}
        className="group flex h-full items-start gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <BookOpen className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="grid min-w-0 flex-1 gap-2">
          <TeacherClassSummary {...props} />
          <p className="break-words text-control text-muted-foreground">
            {formatFormat(props.row.format)} · {teacherClassStage(props.row)}
          </p>
          <p className="flex items-start gap-2 text-control">
            <Clock3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{formatClassScheduleTime(props.row.scheduleSlots)}</span>
          </p>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

type TeacherClassSummaryProps = TeacherClassCardProps;
function TeacherClassSummary(props: TeacherClassSummaryProps): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="break-words text-body font-semibold">{props.row.internalCode}</h3>
      <Badge variant={props.row.status === "ACTIVE" ? "success" : "neutral"}>
        {props.row.status === "ACTIVE" ? "Ativa" : "Arquivada"}
      </Badge>
      <span className="text-caption text-muted-foreground">{props.row.semester.name}</span>
      <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
        <Users className="size-3.5" aria-hidden="true" />
        <span>
          <span className="font-numeric tabular-nums">{props.row.studentCount}</span>{" "}
          {props.row.studentCount === 1 ? "aluno" : "alunos"}
        </span>
      </span>
    </div>
  );
}

type TeacherClassesInput = {
  teacherId: string;
  back: string;
};

type TeacherClassResultsProps = {
  query: QueryResult<RouterOutputs["teachers"]["classes"]>;
  back: string;
  onPageChange: (page: number) => void;
};
function TeacherClassResults({
  query,
  back,
  onPageChange,
}: TeacherClassResultsProps): ReactElement {
  if (query.isError)
    return (
      <Alert variant="destructive">
        <p>Não foi possível carregar as turmas.</p>
        <Button size="compact-responsive" variant="secondary" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (!query.data || query.isFetching)
    return (
      <div role="status" className="grid gap-3 py-4">
        <InlineSkeleton className="w-48" />
        <span className="sr-only">Carregando turmas</span>
      </div>
    );
  if (query.data.rows.length === 0)
    return (
      <EmptyState
        title="Nenhuma turma vinculada"
        description="Atribua este professor na criação ou manutenção de uma turma."
      />
    );
  return (
    <>
      <ul className="grid gap-3 lg:grid-cols-2">
        {query.data.rows.map((row) => (
          <TeacherClassCard key={row.id} row={row} back={back} />
        ))}
      </ul>
      {query.data.pageCount > 1 && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          onPageChange={onPageChange}
          label="Páginas de turmas vinculadas"
        />
      )}
    </>
  );
}

function teacherClassStage(row: TeacherClassCardProps["row"]): string {
  if (row.scheduleType === "PERSONALIZED") return "Trilha e estágio individuais por aluno";
  if (row.sharedStage)
    return `${formatTrackName(row.sharedStage.track.name)} · ${row.sharedStage.name}`;
  return "Trilha e estágio não informados";
}
