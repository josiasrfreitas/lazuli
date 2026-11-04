"use client";

import type { ReactElement } from "react";
import { BookOpen } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import styles from "./class-page.module.css";

type Props = { classId: string; personalized: boolean };
type LatestProgress = RouterOutputs["classRecords"]["progress"]["latest"];

export function ClassStageProgress(props: Props): ReactElement {
  const query = trpc.classRecords.progress.useQuery({ classId: props.classId });
  return (
    <section className={styles.occupancy} aria-label="Último conteúdo">
      <h2 className="flex items-center gap-2 text-caption text-muted-foreground">
        <BookOpen aria-hidden="true" className="size-4 shrink-0" />
        Último conteúdo
      </h2>
      <StageProgressContent
        pending={query.isPending}
        error={query.isError}
        latest={query.data?.latest}
        personalized={props.personalized}
        onRetry={() => void query.refetch()}
      />
    </section>
  );
}

function StageProgressContent({
  pending,
  error,
  latest,
  personalized,
  onRetry,
}: {
  pending: boolean;
  error: boolean;
  latest: LatestProgress | undefined;
  personalized: boolean;
  onRetry: () => void;
}): ReactElement {
  if (pending) {
    return (
      <div role="status">
        <InlineSkeleton className="h-8 w-24" />
        <span className="sr-only">Carregando último conteúdo</span>
      </div>
    );
  }
  if (error) {
    return (
      <>
        <p className="text-caption text-muted-foreground">Conteúdo indisponível</p>
        <Button variant="link" size="inline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </>
    );
  }
  if (personalized) {
    return <p className="text-sm text-muted-foreground">Percursos individuais</p>;
  }
  return <LatestStageProgress latest={latest} />;
}

function LatestStageProgress({ latest }: { latest: LatestProgress | undefined }): ReactElement {
  return (
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
  );
}
