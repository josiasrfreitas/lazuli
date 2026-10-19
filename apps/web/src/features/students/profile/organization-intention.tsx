import { useState } from "react";
import Link from "next/link";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { dateOnly } from "~/features/semester-organization/shared";
import { OrganizationDialogs } from "~/features/class-organization/dialogs";
import type { OrganizationAction } from "~/features/class-organization/model";

export function OrganizationIntention({ studentId }: { studentId: string }) {
  const query = trpc.semesterOrganization.studentIntent.useQuery({ studentId });
  const [semesterId, setSemesterId] = useState("");
  const [action, setAction] = useState<OrganizationAction | null>(null);
  const board = trpc.semesterOrganization.detail.useQuery(
    { semesterId },
    { enabled: Boolean(semesterId) },
  );
  const utils = trpc.useUtils();
  if (query.isPending) return <InlineSkeleton className="h-16 w-full" />;
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
      className="border border-border divide-y divide-border"
      aria-label="Organização de matrícula"
    >
      {query.data.map((intent) => (
        <div
          key={intent.semester.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="grid gap-1">
            <h3 className="text-caption font-semibold">
              {intent.semester.name} ·{" "}
              {intent.placement?.declinedAt
                ? "Não continuará"
                : intent.placement?.publishedAt
                  ? "Alocação confirmada"
                  : intent.placement?.plan
                    ? "Alocação em preparação"
                    : "Aguardando acomodação"}
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
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSemesterId(intent.semester.id);
                setAction({ kind: "availability", studentId });
              }}
            >
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
      ))}
      {action && !board.data && (
        <p className="p-3 text-caption" role="status">
          {board.error ? board.error.message : "Carregando disponibilidade…"}
          <Button size="sm" variant="ghost" onClick={() => setAction(null)}>
            Fechar
          </Button>
        </p>
      )}
      {action && board.data && (
        <OrganizationDialogs
          action={action}
          board={board.data}
          onAction={setAction}
          onClose={() => {
            setAction(null);
            void utils.semesterOrganization.studentIntent.invalidate({ studentId });
          }}
          onSemester={setSemesterId}
          onPlan={() => {}}
          onFeedback={() => {}}
        />
      )}
    </section>
  );
}
