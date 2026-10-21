"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, UserRoundPlus } from "lucide-react";
import { Button } from "@lazuli/ui";
import { NewStudentDialog } from "~/features/students/new-student/new-student-dialog";
import type { Candidate } from "./labels";

export function LeadEnrollment({ candidate }: { candidate: Candidate }): ReactJSX.Element {
  const [open, setOpen] = useState(false);
  const router = useRouter();
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
        candidate.status === "WAITING" && (
          <Button size="compact-responsive" onClick={() => setOpen(true)}>
            <UserRoundPlus />
            Cadastrar aluno
          </Button>
        )
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
