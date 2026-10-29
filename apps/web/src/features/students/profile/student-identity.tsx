import type { ReactElement } from "react";
import { Badge } from "@lazuli/ui";
import { statusBadgeVm } from "../view-model";
import type { StudentProfile } from "./logic";

export function StudentStatus({ profile }: { profile: StudentProfile }): ReactElement {
  const status = statusBadgeVm(profile.contact.status);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={status.variant}>{status.label}</Badge>
      {profile.isScholarshipStudent && <Badge variant="info">Bolsista</Badge>}
    </div>
  );
}
