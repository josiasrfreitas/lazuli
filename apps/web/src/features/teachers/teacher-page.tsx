"use client";
import { type Dispatch, type SetStateAction, type ReactElement, useState } from "react";
import { type ClientError, trpc } from "~/lib/trpc";
import { useSearchParams } from "next/navigation";
import { ToastAlert, Button } from "@lazuli/ui";
import { TeacherDialog } from "./teacher-dialog";
import { DepartureDialog } from "./departure-dialog";
import { TeacherClasses } from "./teacher-classes";
import { TeacherHeaderLoading } from "./teacher-loading";
import { TeacherHeader } from "./teacher-header";
import { TeacherWeek } from "./teacher-week";

export function TeacherPage({ id }: TeacherPageInput): ReactElement {
  const params = useSearchParams();
  const teacher = trpc.teachers.byId.useQuery({ id }, { retry: false });
  const [editing, setEditing] = useState(false);
  const [departing, setDeparting] = useState(false);
  const detail = teacher.data;
  const back = `/professores/${id}?${params.toString()}`;
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[96rem] flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      {teacher.isError && (
        <TeacherLoadError
          teacherError={teacher.error}
          teacherRefetch={() => void teacher.refetch()}
        />
      )}
      {!teacher.isError && (
        <TeacherDetails
          detail={detail}
          setEditing={setEditing}
          setDeparting={setDeparting}
          id={id}
          back={back}
          editing={editing}
          departing={departing}
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
    <ToastAlert variant="destructive">
      <p>{props.teacherError?.message}</p>
      <Button
        size="compact-responsive"
        variant="secondary"
        onClick={() => void props.teacherRefetch()}
      >
        Tentar novamente
      </Button>
    </ToastAlert>
  );
}

type TeacherPageInput = { id: string };

type TeacherDetailsProps = {
  detail?:
    | {
        today: string;
        studentCount: number;
        teacherProfile: { cpf: string | null; departureDate: Date | null } | null;
        id: string;
        email: string;
        name: string;
        isEnabled: boolean;
      }
    | undefined;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setDeparting: Dispatch<SetStateAction<boolean>>;
  id: string;
  back: string;
  editing: boolean;
  departing: boolean;
};
function TeacherDetails(props: TeacherDetailsProps): ReactElement {
  return (
    <>
      {props.detail ? (
        <TeacherHeader
          teacher={props.detail}
          onEdit={() => props.setEditing(true)}
          onDepart={() => props.setDeparting(true)}
        />
      ) : (
        <TeacherHeaderLoading />
      )}
      <TeacherWeek id={props.id} back={props.back} studentCount={props.detail?.studentCount} />
      <TeacherClasses teacherId={props.id} back={props.back} />
      {props.editing && props.detail && (
        <TeacherDialog teacher={props.detail} onClose={() => props.setEditing(false)} />
      )}
      {props.departing && props.detail && (
        <DepartureDialog teacher={props.detail} onClose={() => props.setDeparting(false)} />
      )}
    </>
  );
}
