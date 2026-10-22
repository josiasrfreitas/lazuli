"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { NewStudentDialog } from "../new-student/new-student-dialog";

type PendingAction = RouterOutputs["students"]["pendingActions"]["items"][number];

export function StudentPendingActions({
  studentId,
}: {
  studentId: string;
  name: string;
}): ReactJSX.Element | null {
  const query = trpc.students.pendingActions.useQuery({ id: studentId });
  const [continuing, setContinuing] = useState(false);
  const utils = trpc.useUtils();
  const refresh = (): void => {
    void Promise.all([utils.students.invalidate(), utils.finance.invalidate()]);
  };
  const continueRegistration = (): void => setContinuing(true);
  if (query.isError) return <PendingActionsError onRetry={() => void query.refetch()} />;
  if (!query.data?.items.length) return null;
  return (
    <section className="mt-4 rounded-md border border-border" aria-label="Pendências do aluno">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ClipboardList className="size-4 text-muted-foreground" />
        <h2 className="text-control font-semibold">Pendências</h2>
        <span className="mr-auto text-caption text-muted-foreground">
          {query.data.items.length}
        </span>
        <Button size="sm" onClick={continueRegistration}>
          <ArrowRight />
          Continuar cadastro
        </Button>
      </div>
      <div className="divide-y divide-border">
        {query.data.items.map((item) => (
          <PendingActionRow key={item.id} item={item} onContinue={continueRegistration} />
        ))}
      </div>
      <NewStudentDialog
        open={continuing}
        existingStudentId={studentId}
        onOpenChange={setContinuing}
        onCreated={() => {
          setContinuing(false);
          refresh();
        }}
      />
    </section>
  );
}

function PendingActionsError({ onRetry }: { onRetry: () => void }): ReactJSX.Element {
  return (
    <Alert variant="warning">
      Não foi possível carregar as pendências.{" "}
      <Button variant="ghost" onClick={onRetry}>
        Tentar novamente
      </Button>
    </Alert>
  );
}

function PendingActionRow({
  item,
  onContinue,
}: {
  item: PendingAction;
  onContinue: () => void;
}): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="grid gap-1">
        <h3 className="text-control font-medium">{item.title}</h3>
        <p className="text-caption text-muted-foreground">{item.description}</p>
      </div>
      {item.action.type === "OPEN_LEAD" ? (
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={<Link href={`/interessados/${item.action.resourceId}`} />}
        >
          {item.action.label}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          disabled={item.blockedBy.length > 0}
          onClick={onContinue}
        >
          {item.action.label}
        </Button>
      )}
    </div>
  );
}
