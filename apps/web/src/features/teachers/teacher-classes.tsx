"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Clock3, Users } from "lucide-react";
import { Alert, Badge, Button, EmptyState, InlineSkeleton, Pagination } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatClassScheduleTime, formatFormat, formatTrackName } from "../classes/labels";
export function TeacherClasses({ teacherId, back }: { teacherId: string; back: string }) {
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
      {query.isError ? (
        <Alert variant="destructive">
          <p>Não foi possível carregar as turmas.</p>
          <Button
            size="compact-responsive"
            variant="secondary"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : !query.data || query.isFetching ? (
        <div role="status" className="grid gap-3 py-4">
          <InlineSkeleton className="w-48" />
          <span className="sr-only">Carregando turmas</span>
        </div>
      ) : query.data.rows.length ? (
        <>
          <ul className="grid gap-3 lg:grid-cols-2">
            {query.data.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/turmas/${row.id}?voltar=${encodeURIComponent(back)}`}
                  className="group flex h-full items-start gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <BookOpen
                    className="mt-1 size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="grid min-w-0 flex-1 gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-body font-semibold">{row.internalCode}</h3>
                      <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>
                        {row.status === "ACTIVE" ? "Ativa" : "Arquivada"}
                      </Badge>
                      <span className="text-caption text-muted-foreground">{row.semester.name}</span>
                      <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
                        <Users className="size-3.5" aria-hidden="true" />
                        <span><span className="font-numeric tabular-nums">{row.studentCount}</span> {row.studentCount === 1 ? "aluno" : "alunos"}</span>
                      </span>
                    </div>
                    <p className="break-words text-control text-muted-foreground">
                      {formatFormat(row.format)} · {row.scheduleType === "PERSONALIZED"
                        ? "Trilha e estágio individuais por aluno"
                        : row.sharedStage
                          ? `${formatTrackName(row.sharedStage.track.name)} · ${row.sharedStage.name}`
                          : "Trilha e estágio não informados"}
                    </p>
                    <p className="flex items-start gap-2 text-control">
                      <Clock3
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{formatClassScheduleTime(row.scheduleSlots)}</span>
                    </p>
                  </div>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
          {query.data.pageCount > 1 && (
            <Pagination
              page={query.data.page}
              pageCount={query.data.pageCount}
              onPageChange={setPage}
              label="Páginas de turmas vinculadas"
            />
          )}
        </>
      ) : (
        <EmptyState
          title="Nenhuma turma vinculada"
          description="Atribua este professor na criação ou manutenção de uma turma."
        />
      )}
    </section>
  );
}
