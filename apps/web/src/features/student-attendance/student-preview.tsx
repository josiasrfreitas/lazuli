"use client";

import { useState } from "react";
import { StudentAttendanceFrame } from "./student-frame";
import { StudentDeclaration } from "./student-page";

export function StudentAttendancePreview() {
  const [expiresAt] = useState(() => new Date(Date.now() + 20 * 60_000));
  const info = {
    sessionId: "00000000-0000-4000-8000-000000000001",
    className: "Essentials 1",
    date: "2026-10-20",
    startTime: "10:00",
    endTime: "11:00",
    format: "ONLINE" as const,
    expiresAt,
  };
  return (
    <StudentAttendanceFrame preview lesson={info}>
      <StudentDeclaration preview token="" info={info} />
    </StudentAttendanceFrame>
  );
}
