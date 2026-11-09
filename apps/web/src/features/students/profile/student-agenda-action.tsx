"use client";

import { lazy, Suspense, useState, type ReactElement } from "react";
import { CalendarDays } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Button } from "@lazuli/ui";
import type { StudentProfile } from "./logic";

const StudentAgendaDialog = lazy(() =>
  import("./student-agenda-dialog").then((module) => ({ default: module.StudentAgendaDialog })),
);

/** Keep calendar and record editors out of the closed header action. */
export function StudentAgendaAction({
  profile,
  canSchedule,
  secondary = false,
}: {
  profile: StudentProfile;
  canSchedule: boolean;
  secondary?: boolean;
}): ReactElement {
  const [activated, setActivated] = useState(false);
  const [appointmentId] = useQueryState("atendimento", parseAsString);
  if (activated || appointmentId) {
    return (
      <Suspense fallback={<AgendaButton secondary={secondary} busy />}>
        <StudentAgendaDialog
          profile={profile}
          canSchedule={canSchedule}
          secondary={secondary}
          initialOpen={activated}
        />
      </Suspense>
    );
  }
  return <AgendaButton secondary={secondary} onOpen={() => setActivated(true)} />;
}

function AgendaButton({
  secondary,
  busy = false,
  onOpen,
}: {
  secondary: boolean;
  busy?: boolean;
  onOpen?: () => void;
}): ReactElement {
  return (
    <Button
      size="sm"
      variant={secondary ? "secondary" : "primary"}
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={onOpen}
    >
      <CalendarDays aria-hidden="true" /> Agenda
    </Button>
  );
}
