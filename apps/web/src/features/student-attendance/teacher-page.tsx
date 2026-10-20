"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { TeacherPage, TeacherQueryState } from "~/features/teacher-workspace/shared";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import type { ClassRecord } from "~/features/class-records/shared";
import { AttendanceSharePanel } from "./share-panel";
import type { AttendanceStatus } from "./staff-section";
import { AttendanceReview } from "./attendance-review";

export function TeacherAttendancePage({ sessionId }: { sessionId: string }) {
  const detail = trpc.classRecords.detail.useQuery({ sessionId }, { retry: false });
  const status = trpc.studentAttendance.status.useQuery(
    { sessionId },
    { refetchInterval: 3_000, retry: false },
  );
  const data = detail.data;
  return (
    <TeacherPage
      title={data ? `Chamada · ${data.session.className}` : "Chamada"}
      description={
        data
          ? `${formatDateOnlyBR(data.session.date)} · ${data.session.startTime}–${data.session.endTime} · ${data.session.format === "ONLINE" ? "Online" : "Presencial"}`
          : undefined
      }
      back={`/professor/agenda${data ? `?dia=${data.session.date}` : ""}`}
    >
      <TeacherQueryState
        label="Carregando chamada"
        pending={detail.isPending || status.isPending}
        error={detail.error ?? status.error}
        retry={() => {
          void detail.refetch();
          void status.refetch();
        }}
      />
      {data && status.data && (
        <LiveAttendanceReview
          key={`${sessionId}:${data.attendanceStamp}:${data.version}`}
          data={data}
          status={status.data}
          statusFailed={status.isError}
        />
      )}
    </TeacherPage>
  );
}

function LiveAttendanceReview({
  data,
  status,
  statusFailed,
}: {
  data: ClassRecord;
  status: AttendanceStatus;
  statusFailed: boolean;
}) {
  const sessionId = data.session.id;
  const [record, setRecord] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const utils = trpc.useUtils();
  const save = trpc.studentAttendance.confirm.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.classRecords.invalidate(),
        utils.studentAttendance.invalidate(),
        utils.attendance.invalidate(),
        utils.teacherWorkspace.invalidate(),
        utils.students.invalidate(),
        utils.classes.invalidate(),
        utils.activity.invalidate(),
      ]);
    },
    onError: () => {
      void utils.studentAttendance.status.invalidate({ sessionId });
    },
  });
  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        utils.classRecords.detail.invalidate({ sessionId }),
        utils.studentAttendance.status.invalidate({ sessionId }),
      ]);
      save.reset();
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <>
      <AttendanceReview
        data={data}
        status={status}
        statusFailed={statusFailed}
        saving={save.isPending}
        saved={save.isSuccess}
        refreshing={refreshing}
        error={
          save.error
            ? { message: save.error.message, conflict: save.error.data?.code === "CONFLICT" }
            : null
        }
        onConfirm={(input) => save.mutate(input)}
        onChange={() => save.reset()}
        onRefresh={() => void refresh()}
        onRecord={() => setRecord(true)}
        sharing={
          <AttendanceSharePanel
            sessionId={sessionId}
            status={status}
            disabled={save.isPending || statusFailed}
          />
        }
      />
      {record && (
        <ClassRecordDialog id={sessionId} initialEditing onClose={() => setRecord(false)} />
      )}
    </>
  );
}
