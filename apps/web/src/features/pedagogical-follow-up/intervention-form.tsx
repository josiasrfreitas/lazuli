"use client";
import type { ReactElement } from "react";
import type { Occurrence } from "./shared";
import { StudentInterventionForm } from "./student-intervention-form";

export function InterventionForm({
  source,
  onClose,
  onCreated,
}: {
  source: Occurrence;
  onClose: () => void;
  onCreated?: (id: string) => void;
}): ReactElement {
  return (
    <StudentInterventionForm
      student={{ id: source.studentId, name: source.student.fullName }}
      initialOccurrenceIds={[source.id]}
      onClose={onClose}
      {...(onCreated ? { onCreated } : {})}
    />
  );
}
