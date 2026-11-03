"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, UserRoundPlus } from "lucide-react";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { Button } from "@lazuli/ui";
import { NewStudentDialog } from "~/features/students/new-student/new-student-dialog";
import type { Candidate } from "./labels";
const ISO_DATE_END = 10;

export function LeadEnrollment({ candidate }: { candidate: Candidate }): ReactJSX.Element {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const period = candidate.allocationPlan?.semester;
  const today = toDateOnlySaoPaulo(new Date());
  const waitingForPeriod = Boolean(
    period && period.startDate.toISOString().slice(0, ISO_DATE_END) > today,
  );
  return (
    <>
      {candidate.studentId ? (
        <Button
          size="compact-responsive"
          nativeButton={false}
          render={<Link href={`/alunos/${candidate.studentId}`} />}
        >
          <ArrowUpRight />
          Abrir aluno
        </Button>
      ) : (
        candidate.status === "WAITING" &&
        (waitingForPeriod && period ? (
          <p className="text-caption text-muted-foreground">
            Entrada prevista a partir de{" "}
            {formatDateOnlyBR(period.startDate.toISOString().slice(0, ISO_DATE_END))}
          </p>
        ) : (
          <Button size="compact-responsive" onClick={() => setOpen(true)}>
            <UserRoundPlus />
            Concluir entrada
          </Button>
        ))
      )}
      <NewStudentDialog
        open={open}
        initialCandidateId={candidate.id}
        onOpenChange={setOpen}
        onCreated={(id) => router.push(`/alunos/${id}`)}
      />
    </>
  );
}
