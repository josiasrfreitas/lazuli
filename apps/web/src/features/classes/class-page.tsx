"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Badge, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";

import { formatClassScheduleTime, formatFormat, formatScheduleType } from "./labels";
import { ClassEditDialog } from "./edit-dialog";
import { MembershipDialog } from "./membership-dialog";
import { RosterSection } from "./roster-section";
import { ActionHistory } from "./action-history";

export function ClassPage({ id }: { id: string }): ReactElement {
  const query = trpc.classes.byId.useQuery({ id }, { retry: false });
  const params = useSearchParams();
  const back = params.get("voltar");
  const safeBack = back?.startsWith("/turmas") && !back.startsWith("//") ? back : "/turmas";
  const detail = query.data;
  return (
    <main className="mx-auto flex h-full min-h-0 w-full min-w-0 max-w-[96rem] flex-col gap-4 overflow-y-auto p-6">
      <Link
        className="w-fit text-caption text-muted-foreground underline-offset-2 hover:underline"
        href={safeBack}
      >
        ← Voltar para Turmas
      </Link>
      {query.isError && (
        <div role="alert" className="space-y-2">
          <p>
            {query.error.data?.code === "NOT_FOUND"
              ? "Turma não encontrada."
              : "Não foi possível carregar a turma."}
          </p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {query.isPending && <p role="status">Carregando turma…</p>}
      {detail && <ClassDetailView detail={detail} id={id} />}
    </main>
  );
}

function ClassDetailView({
  detail,
  id,
}: {
  detail: RouterOutputs["classes"]["byId"];
  id: string;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [membership, setMembership] = useState<"ENTRY" | "RETURN" | null>(null);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-semibold">{detail.internalCode}</h1>
          <p className="text-caption text-muted-foreground">{detail.portalClassName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Editar dados
          </Button>
          <Button variant="secondary" onClick={() => setMembership("RETURN")}>
            Retornar aluno
          </Button>
          <Button onClick={() => setMembership("ENTRY")}>Matricular aluno</Button>
        </div>
      </div>
      <ClassSummary detail={detail} />
      <RosterSection classId={id} />
      <ActionHistory classId={id} />
      <ClassEditDialog detail={detail} open={editing} onOpenChange={setEditing} />
      {membership && (
        <MembershipDialog
          mode={membership}
          classId={id}
          scheduleType={detail.scheduleType}
          open
          onOpenChange={(open) => {
            if (!open) setMembership(null);
          }}
        />
      )}
    </>
  );
}
function ClassSummary({ detail }: { detail: RouterOutputs["classes"]["byId"] }): ReactElement {
  return (
    <dl className="grid gap-3 border-b border-border pb-4 text-control sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="text-caption text-muted-foreground">Organização</dt>
        <dd>
          {formatScheduleType(detail.scheduleType)} · {formatFormat(detail.format)}
        </dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">Professor</dt>
        <dd>{detail.teacher.name}</dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">Etapa e semestre</dt>
        <dd>
          {detail.sharedStage?.name ?? "Etapa individual"} · {detail.semester.name}
        </dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">Horário e ocupação</dt>
        <dd>
          {formatClassScheduleTime(detail.scheduleSlots)} · {detail.occupancy}/{detail.capacity}{" "}
          {detail.occupancy >= detail.capacity && (
            <Badge variant="warning">
              {detail.occupancy > detail.capacity ? "Acima da capacidade" : "Cheia"}
            </Badge>
          )}
        </dd>
        <dd className="text-caption text-muted-foreground">
          {detail.scheduledEntries}{" "}
          {detail.scheduledEntries === 1 ? "entrada programada" : "entradas programadas"}
        </dd>
      </div>
    </dl>
  );
}
