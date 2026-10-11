import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import Link from "next/link";
import { Alert, Badge, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { visitLabels } from "~/features/admissions/labels";
import type { Meeting } from "./meeting-dialog";

type Guest = RouterOutputs["admissions"]["guests"][number];
export function MeetingGuests({ meeting }: { meeting: Meeting }): ReactElement | null {
  const query = trpc.admissions.guests.useQuery({
    classId: meeting.classId,
    date: meeting.date,
    scheduleSlotId: meeting.slotId,
    classSessionId: meeting.slotId ? null : meeting.sessionId,
  });
  if (query.isPending) return <InlineSkeleton className="h-6 w-full" />;
  if (query.isError)
    return (
      <Alert variant="warning">Não foi possível consultar os convidados deste encontro.</Alert>
    );
  if (!query.data.length) return null;
  return (
    <section
      className="grid gap-2 border-b border-border pb-4"
      aria-label="Convidados da aula experimental"
    >
      <h3 className="text-control font-semibold">Convidados · aula experimental</h3>
      <p className="text-caption text-muted-foreground">
        Comparecimento registrado no interesse, separado da chamada da turma.
      </p>
      <ul className="divide-y divide-border">
        {query.data.map((guest) => (
          <GuestRow key={guest.id} guest={guest} />
        ))}
      </ul>
    </section>
  );
}
function GuestRow({ guest }: { guest: Guest }): ReactElement {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <Link
        href={`/interessados/${guest.candidate.id}`}
        className="font-medium underline-offset-4 hover:underline"
      >
        {guest.candidate.fullName}
      </Link>
      <Badge variant={guest.status === "ATTENDED" ? "success" : "neutral"}>
        {visitLabels[guest.status]}
      </Badge>
    </li>
  );
}
