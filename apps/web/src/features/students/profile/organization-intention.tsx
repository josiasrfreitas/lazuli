import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { dateOnly } from "~/features/class-organization/shared";
import styles from "./student-profile.module.css";

export function OrganizationIntention({
  studentId,
}: {
  studentId: string;
}): ReactJSX.Element | null {
  const query = trpc.semesterOrganization.studentIntent.useQuery({ studentId });
  if (query.isPending) return null;
  if (query.error)
    return (
      <div className="text-caption text-destructive">
        Não foi possível carregar as turmas propostas.
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!query.data?.length) return null;
  return (
    <section
      className={`${styles.lateData} border border-border divide-y divide-border`}
      aria-label="Turmas do aluno"
    >
      {query.data.map(({ semester, placement }) => (
        <div
          key={placement.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="grid gap-1">
            <h3 className="text-caption font-semibold">
              {semester.name} ·{" "}
              {placement.declinedAt
                ? "Não continuará"
                : placement.publishedAt
                  ? "Turma confirmada"
                  : placement.plan
                    ? "Turma a confirmar"
                    : "Aguardando turma"}
            </h3>
            <p className="text-caption text-muted-foreground">
              {placement.plan?.name ?? "Sem turma definida"} ·{" "}
              {placement.stage?.internalCode ?? "Estágio a definir"}
              {placement.effectiveDate
                ? ` · a partir de ${formatDateOnlyBR(dateOnly(placement.effectiveDate))}`
                : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href={`/organizacao?semestre=${semester.id}`} />}
          >
            Ver turma
          </Button>
        </div>
      ))}
    </section>
  );
}
