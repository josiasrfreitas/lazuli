"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import styles from "./class-page.module.css";

type Props = { classId: string; className: string; personalized: boolean };

export function ClassStageProgress(props: Props): ReactElement {
  const query = trpc.classRecords.progress.useQuery({ classId: props.classId });
  const latest = query.data?.latest;
  return (
    <section
      className={`${styles.occupancy} ${styles.stageProgress}`}
      aria-label="Progresso do estágio"
    >
      <h2 className="flex items-center gap-2 text-caption text-muted-foreground">
        <BookOpen aria-hidden="true" className="size-4 shrink-0" />
        Progresso do estágio
      </h2>
      {query.isPending ? (
        <div role="status">
          <InlineSkeleton className="h-8 w-24" />
          <span className="sr-only">Carregando progresso</span>
        </div>
      ) : query.isError ? (
        <>
          <p className="text-caption text-muted-foreground">Progresso indisponível</p>
          <Button variant="link" size="inline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </>
      ) : props.personalized ? (
        <p className="text-sm text-muted-foreground">Percursos individuais</p>
      ) : (
        <>
          <p className={styles.occupancyValue}>
            {latest ? (
              <>
                <span>Página</span> {latest.page}
              </>
            ) : (
              "—"
            )}
          </p>
          <p className="text-caption text-muted-foreground" title={latest?.reference ?? undefined}>
            {latest ? `Aula de ${formatDateOnlyBR(latest.date)}` : "Sem páginas registradas"}
          </p>
        </>
      )}
      <Button
        variant="link"
        size="inline"
        nativeButton={false}
        render={<Link href={`/turmas/${props.classId}?secao=aulas#aulas-da-turma`} />}
      >
        Ver aulas da turma
      </Button>
    </section>
  );
}
