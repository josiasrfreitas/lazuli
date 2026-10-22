import type { ReactElement } from "react";
import { BookOpenText, Plus, Search } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { QueryState } from "./shared";
import { DeskDetailLoading } from "./student-desk-loading";
import { DeskOccurrence } from "./desk-occurrence";
import { DeskIntervention } from "./desk-intervention";
import type { SelectFollowUp } from "./student-navigation";
import styles from "./student-desk.module.css";

export function DeskEmptyDetail({
  studentId,
  create,
  select,
  readOnly = false,
}: {
  studentId: string;
  create: () => void;
  select: SelectFollowUp;
  readOnly?: boolean;
}): ReactElement {
  const input = { studentId, search: "", page: 1 };
  const occurrences = trpc.occurrences.list.useQuery(input);
  const interventions = trpc.interventions.list.useQuery(input);
  if (occurrences.isPending || interventions.isPending) return <DeskDetailLoading />;
  if (!occurrences.data || !interventions.data)
    return (
      <QueryState
        pending={occurrences.isPending || interventions.isPending}
        error={occurrences.error ?? interventions.error}
        retry={() => {
          void occurrences.refetch();
          void interventions.refetch();
        }}
      />
    );
  return (
    <DeskFirstRecord
      occurrenceId={occurrences.data.rows[0]?.id}
      interventionId={interventions.data.rows[0]?.id}
      studentId={studentId}
      select={select}
      readOnly={readOnly}
      create={create}
    />
  );
}

function DeskFirstRecord({
  occurrenceId,
  interventionId,
  studentId,
  select,
  readOnly,
  create,
}: {
  occurrenceId?: string | undefined;
  interventionId?: string | undefined;
  studentId: string;
  select: SelectFollowUp;
  readOnly: boolean;
  create: () => void;
}): ReactElement {
  if (occurrenceId)
    return (
      <DeskOccurrence id={occurrenceId} studentId={studentId} select={select} readOnly={readOnly} />
    );
  if (interventionId)
    return (
      <DeskIntervention
        id={interventionId}
        studentId={studentId}
        select={select}
        readOnly={readOnly}
      />
    );
  if (readOnly)
    return (
      <p className="p-5 text-sm text-muted-foreground">Nenhum registro pedagógico anterior.</p>
    );
  return <DeskEmptyContent create={create} />;
}

function DeskEmptyContent({ create }: { create: () => void }): ReactElement {
  return (
    <div className={styles.emptyDetail}>
      <BookOpenText aria-hidden="true" />
      <h3>Toda história começa com um primeiro registro.</h3>
      <p>
        Este espaço vai reunir as observações, as tratativas e as evoluções do aluno. Quando houver
        algo para compartilhar, comece por uma ocorrência.
      </p>
      <Button size="sm" onClick={create}>
        <Plus aria-hidden="true" />
        Registrar primeira ocorrência
      </Button>
    </div>
  );
}

export function DeskEmptyList({
  filtered,
  kind,
}: {
  filtered: boolean;
  kind: "occurrence" | "intervention";
}): ReactElement {
  const copy =
    kind === "occurrence"
      ? {
          title: "As primeiras páginas estão por vir",
          body: "As observações das aulas aparecerão aqui, uma história de cada vez.",
        }
      : {
          title: "Nenhuma intervenção por aqui",
          body: "As tratativas realizadas com o aluno aparecerão aqui.",
        };
  const Icon = filtered ? Search : BookOpenText;
  return (
    <div className={styles.emptyList} role="status">
      <Icon aria-hidden="true" />
      <strong>{filtered ? "Nenhum registro encontrado" : copy.title}</strong>
      <p>{filtered ? "Tente outro termo." : copy.body}</p>
    </div>
  );
}
