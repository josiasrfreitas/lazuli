"use client";
import { type Dispatch, type SetStateAction, type ReactElement, useState } from "react";
import { type ClientError, trpc } from "~/lib/trpc";
import { useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { civilDateSchema } from "@lazuli/validators";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";
import { mondayOf, todayInSchool } from "./format";
import { TeacherDialog } from "./teacher-dialog";
import { DepartureDialog } from "./departure-dialog";
import { TeacherClasses } from "./teacher-classes";
import { TeacherHeader } from "./teacher-header";
import { TeacherWeek } from "./teacher-week";
import { MeetingDialog, type Meeting } from "./meeting-dialog";

export function TeacherPage({ id }: TeacherPageInput): ReactElement {
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[96rem] flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      {teacher.isPending && (
        <div role="status" className="grid gap-3">
          <InlineSkeleton className="h-6 w-48" />
          <InlineSkeleton className="w-64" />
          <span className="sr-only">Carregando professor</span>
        </div>
      )}
      {teacher.isError && (
        <TeacherLoadError
          teacherError={teacher.error}
          teacherRefetch={() => void teacher.refetch()}
        />
      )}
      {detail && (
        <TeacherDetails
          detail={detail}
          setEditing={setEditing}
          setDeparting={setDeparting}
          id={id}
          week={week}
          setAnchor={setAnchor}
          setMeeting={setMeeting}
          back={back}
          editing={editing}
          departing={departing}
          meeting={meeting}
        />
      )}
    </div>
  );
}

type TeacherLoadErrorProps = {
  teacherError: ClientError | null;
  teacherRefetch: () => void;
};
function TeacherLoadError(props: TeacherLoadErrorProps): ReactElement {
  return (
    <Alert variant="destructive">
      <p>{props.teacherError?.message}</p>
      <Button
        size="compact-responsive"
        variant="secondary"
        onClick={() => void props.teacherRefetch()}
      >
        Tentar novamente
      </Button>
    </Alert>
  );
}

type TeacherPageInput = { id: string };

type TeacherDetailsProps = {
  detail: {
    today: string;
    studentCount: number;
    teacherProfile: { cpf: string | null; departureDate: Date | null } | null;
    id: string;
    email: string;
    name: string;
    isEnabled: boolean;
  };
  setEditing: Dispatch<SetStateAction<boolean>>;
  setDeparting: Dispatch<SetStateAction<boolean>>;
  id: string;
  week: string;
  setAnchor: (value: string) => Promise<URLSearchParams>;
  setMeeting: Dispatch<SetStateAction<Meeting | null>>;
  back: string;
  editing: boolean;
  departing: boolean;
  meeting: Meeting | null;
};
function TeacherDetails(props: TeacherDetailsProps): ReactElement {
  return (
    <>
      <TeacherHeader
        teacher={props.detail}
        onEdit={() => props.setEditing(true)}
        onDepart={() => props.setDeparting(true)}
      />
      <TeacherWeek
        id={props.id}
        week={props.week}
        today={props.detail.today}
        studentCount={props.detail.studentCount}
        onWeekChange={(value) => void props.setAnchor(value)}
        onOpen={props.setMeeting}
      />
      <TeacherClasses teacherId={props.id} back={props.back} />
      {props.editing && (
        <TeacherDialog teacher={props.detail} onClose={() => props.setEditing(false)} />
      )}
      {props.departing && (
        <DepartureDialog teacher={props.detail} onClose={() => props.setDeparting(false)} />
      )}
      {props.meeting && (
        <MeetingDialog
          meeting={props.meeting}
          back={props.back}
          onClose={() => props.setMeeting(null)}
        />
      )}
    </>
  );
}
