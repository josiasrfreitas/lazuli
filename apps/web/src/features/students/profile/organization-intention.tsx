import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { dateOnly } from "~/features/semester-organization/shared";
import { OrganizationDialogs } from "~/features/class-organization/dialogs";
import type { OrganizationAction } from "~/features/class-organization/model";
import type { RouterOutputs } from "@lazuli/api";
import styles from "./student-profile.module.css";

type StudentIntent = RouterOutputs["semesterOrganization"]["studentIntent"][number];

function intentionStatus(intent: StudentIntent): string {
  if (intent.placement?.declinedAt) return "Não continuará";
  if (intent.placement?.publishedAt) return "Alocação confirmada";
  if (intent.placement?.plan) return "Alocação em preparação";
  return "Aguardando acomodação";
}

export function OrganizationIntention({
  studentId,
}: {
  studentId: string;
}): ReactJSX.Element | null {
  const query = trpc.semesterOrganization.studentIntent.useQuery({ studentId });
  const [semesterId, setSemesterId] = useState("");
  const [action, setAction] = useState<OrganizationAction | null>(null);
  const board = trpc.semesterOrganization.detail.useQuery(
    { semesterId },
    { enabled: Boolean(semesterId) },
  );
  const openAvailability = (id: string): void => {
    setSemesterId(id);
    setAction({ kind: "availability", studentId });
  };
  if (query.isPending) return null;
  if (query.error)
    return (
      <div className="text-caption text-destructive">
        Não foi possível carregar a intenção de matrícula.{" "}
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!query.data?.length) return null;
  return (
    <section
      className={`${styles.lateData} border border-border divide-y divide-border`}
      aria-label="Organização de matrícula"
    >
      {query.data.map((intent) => (
        <OrganizationIntentRow
          key={intent.semester.id}
          intent={intent}
          onAvailability={openAvailability}
        />
      ))}
      <OrganizationIntentDialogs
        action={action}
        board={board}
        studentId={studentId}
        onAction={setAction}
        onSemester={setSemesterId}
      />
    </section>
  );
}

function OrganizationIntentDialogs({
  action,
  board,
  studentId,
  onAction,
  onSemester,
}: {
  action: OrganizationAction | null;
  board: {
    data: RouterOutputs["semesterOrganization"]["detail"] | undefined;
    error: { message: string } | null;
  };
  studentId: string;
  onAction: (action: OrganizationAction | null) => void;
  onSemester: (semesterId: string) => void;
}): ReactJSX.Element {
  const utils = trpc.useUtils();
  return (
    <>
      {action && !board.data && (
        <p className="p-3 text-caption" role="status">
          {board.error ? board.error.message : "Carregando disponibilidade…"}
          <Button size="sm" variant="ghost" onClick={() => onAction(null)}>
            Fechar
          </Button>
        </p>
      )}
      {action && board.data && (
        <OrganizationDialogs
          action={action}
          board={board.data}
          onAction={onAction}
          onClose={() => {
            onAction(null);
            void utils.semesterOrganization.studentIntent.invalidate({ studentId });
          }}
          onSemester={onSemester}
          onPlan={() => {}}
          onFeedback={() => {}}
        />
      )}
    </>
  );
}

function OrganizationIntentRow({
  intent,
  onAvailability,
}: {
  intent: StudentIntent;
  onAvailability: (semesterId: string) => void;
}): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="grid gap-1">
        <h3 className="text-caption font-semibold">
          {intent.semester.name} · {intentionStatus(intent)}
        </h3>
        <p className="text-caption text-muted-foreground">
          {intent.placement?.plan?.name ?? "Sem turma definida"} ·{" "}
          {intent.placement?.stage?.internalCode ?? "Estágio a definir"}
          {intent.placement?.effectiveDate
            ? ` · a partir de ${formatDateOnlyBR(dateOnly(intent.placement.effectiveDate))}`
            : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => onAvailability(intent.semester.id)}>
          Disponibilidade
        </Button>
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href={`/organizacao?semestre=${intent.semester.id}`} />}
        >
          Ver organização
        </Button>
      </div>
    </div>
  );
}
