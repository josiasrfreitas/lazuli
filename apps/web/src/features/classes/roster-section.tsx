"use client";
import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { CloseMembershipDialog } from "./close-dialog";
import { MembershipDialog } from "./membership-dialog";
import type { RosterRow } from "./roster-status";
import { RosterList } from "./roster-list";
import styles from "./class-page.module.css";

export function RosterSection({
  classId,
  showStage,
}: {
  classId: string;
  showStage: boolean;
}): ReactElement {
  const state = useRoster(classId);
  const [returning, setReturning] = useState<RosterRow | null>(null);
  return (
    <section aria-label="Alunos da turma" className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className={styles.rosterContent} data-ready={Boolean(state.query.data) || undefined}>
        <RosterList
          key={state.page}
          data={state.query.data}
          failed={state.query.isError}
          refetch={() => void state.query.refetch()}
          page={state.page}
          setPage={state.setPage}
          showStage={showStage}
          resume={setReturning}
          close={(row) => state.setClosing({ id: row.id, studentName: row.student.fullName })}
        />
      </div>
      <RosterReturnDialog
        returning={returning}
        classId={classId}
        showStage={showStage}
        setReturning={setReturning}
      />
      <CloseMembershipDialog
        enrollment={state.closing}
        classId={classId}
        onOpenChange={(value) => {
          if (!value) state.setClosing(null);
        }}
      />
    </section>
  );
}

function RosterReturnDialog({
  returning,
  classId,
  showStage,
  setReturning,
}: {
  returning: RosterRow | null;
  classId: string;
  showStage: boolean;
  setReturning: (row: RosterRow | null) => void;
}): ReactElement | null {
  if (!returning) return null;
  return (
    <MembershipDialog
      mode="RETURN"
      source={{ id: returning.id, name: returning.student.fullName }}
      classId={classId}
      scheduleType={showStage ? "PERSONALIZED" : "REGULAR"}
      open
      onOpenChange={(open) => {
        if (!open) setReturning(null);
      }}
    />
  );
}

function useRoster(classId: string): RosterState {
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<{ id: string; studentName: string } | null>(null);
  const query = trpc.classes.roster.useQuery({
    id: classId,
    page,
    pageSize: 25,
  });
  return {
    page,
    closing,
    setClosing,
    query,
    setPage,
  };
}

type RosterState = {
  page: number;
  closing: { id: string; studentName: string } | null;
  setClosing: (value: { id: string; studentName: string } | null) => void;
  query: QueryResult<RouterOutputs["classes"]["roster"]>;
  setPage: (value: number) => void;
};
