"use client";

import Link from "next/link";
import { ArrowUpRight, QrCode } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Button } from "@lazuli/ui";
import { attendanceTime } from "./location";

export type AttendanceStatus = RouterOutputs["studentAttendance"]["status"];

export function StudentAttendanceSection({ sessionId }: { sessionId: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <p className="text-caption text-muted-foreground">
        QR Code, link e conferência de presença em uma única tela.
      </p>
      <Button
        variant="secondary"
        nativeButton={false}
        render={<Link href={`/professor/agenda/${sessionId}/chamada`} />}
      >
        <QrCode aria-hidden="true" /> Abrir chamada <ArrowUpRight aria-hidden="true" />
      </Button>
    </div>
  );
}

export function DeclarationEvidence({
  value,
}: {
  value: AttendanceStatus["declarations"][number];
}) {
  return (
    <p className="text-caption text-muted-foreground">
      {value.format === "ONLINE" ? "Link" : "QR Code"} · {attendanceTime(value.submittedAt)}
    </p>
  );
}
