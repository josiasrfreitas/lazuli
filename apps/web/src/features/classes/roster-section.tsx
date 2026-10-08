"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { CloseMembershipDialog } from "./close-dialog";
import { RosterList } from "./roster-list";

export function RosterSection({
  classId,
  search,
  sidebar,
  showStage,
}: {
  classId: string;
  search: string;
  sidebar: ReactNode;
  showStage: boolean;
}): ReactElement {
  const state = useRoster(classId, search);
  return (
    <section aria-label="Alunos da turma" className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className="grid min-h-0 min-w-0 gap-5 lg:flex lg:flex-1">
        {sidebar}
        <div className="@container flex min-h-0 min-w-0 flex-col lg:flex-1">
          <RosterList
            key={state.page}
            data={state.query.data}
            failed={state.query.isError}
            refetch={() => void state.query.refetch()}
            page={state.page}
            setPage={state.setPage}
            showStage={showStage}
            close={(row) => state.setClosing({ id: row.id, studentName: row.student.fullName })}
          />
        </div>
      </div>
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

function useRoster(classId: string, search: string): RosterState {
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<{ id: string; studentName: string } | null>(null);
  const query = trpc.classes.roster.useQuery({
    id: classId,
    search,
    page,
    pageSize: 20,
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
