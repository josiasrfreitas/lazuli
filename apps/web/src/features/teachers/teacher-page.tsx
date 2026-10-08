"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { civilDateSchema } from "@lazuli/validators";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { mondayOf, safeTeacherReturn, todayInSchool } from "./format";
import { TeacherDialog } from "./teacher-dialog";
import { DepartureDialog } from "./departure-dialog";
import { TeacherClasses } from "./teacher-classes";
import { TeacherHeader } from "./teacher-header";
import { TeacherWeek } from "./teacher-week";
import { MeetingDialog, type Meeting } from "./meeting-dialog";
export function TeacherPage({ id }: { id: string }) {
  const params = useSearchParams();
  const [anchor, setAnchor] = useQueryState("semana", parseAsString);
  const parsed = civilDateSchema.safeParse(anchor);
  const week = mondayOf(parsed.success ? parsed.data : todayInSchool());
  const teacher = trpc.teachers.byId.useQuery({ id }, { retry: false });
  const [editing, setEditing] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const detail = teacher.data;
  const back = `/professores/${id}?${params.toString()}`;
  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-[96rem] flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      <Link
        href={safeTeacherReturn(params.get("voltar"))}
        className="w-fit text-caption text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Voltar para Professores
      </Link>
      {teacher.isPending && (
        <div role="status" className="grid gap-3">
          <InlineSkeleton className="h-6 w-48" />
          <InlineSkeleton className="w-64" />
          <span className="sr-only">Carregando professor</span>
        </div>
      )}
      {teacher.isError && (
        <Alert variant="destructive">
          <p>{teacher.error.message}</p>
          <Button
            size="compact-responsive"
            variant="secondary"
            onClick={() => void teacher.refetch()}
          >
            Tentar novamente
          </Button>
        </Alert>
      )}
      {detail && (
        <>
          <TeacherHeader
            teacher={detail}
            onEdit={() => setEditing(true)}
            onDepart={() => setDeparting(true)}
          />
          <TeacherWeek
            id={id}
            week={week}
            today={detail.today}
            onWeekChange={(value) => void setAnchor(value)}
            onOpen={setMeeting}
          />
          <TeacherClasses teacherId={id} back={back} />
          {editing && <TeacherDialog teacher={detail} onClose={() => setEditing(false)} />}
          {departing && <DepartureDialog teacher={detail} onClose={() => setDeparting(false)} />}
          {meeting && (
            <MeetingDialog meeting={meeting} back={back} onClose={() => setMeeting(null)} />
          )}
        </>
      )}
    </main>
  );
}
