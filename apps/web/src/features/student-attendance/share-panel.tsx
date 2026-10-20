"use client";

import { useEffect, useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { attendanceTokenSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import type { AttendanceStatus } from "./staff-section";
import { AttendanceShareControls } from "./share-controls";

type QrLink = RouterOutputs["studentAttendance"]["open"];
type StoredLink = Omit<QrLink, "expiresAt"> & { expiresAt: string };

export function AttendanceSharePanel({
  sessionId,
  status,
  disabled,
}: {
  sessionId: string;
  status: AttendanceStatus;
  disabled: boolean;
}) {
  const [link, setLink] = useState<QrLink | null>(null);
  const [minutes, setMinutes] = useState<10 | 20 | 30>(10);
  const [origin, setOrigin] = useState("");
  const utils = trpc.useUtils();
  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const stored = sessionStorage.getItem(`attendance-link:${sessionId}`);
      if (!stored) return;
      const value = JSON.parse(stored) as StoredLink;
      if (
        typeof value.id === "string" &&
        attendanceTokenSchema.safeParse({ token: value.token }).success &&
        attendanceTokenSchema.safeParse({ token: value.projectionToken }).success &&
        Number.isFinite(new Date(value.expiresAt).getTime())
      )
        setLink({ ...value, expiresAt: new Date(value.expiresAt) });
    } catch {
      // Sharing remains available when browser storage is disabled.
    }
  }, [sessionId]);
  const open = trpc.studentAttendance.open.useMutation({
    onSuccess: async (result) => {
      setLink(result);
      try {
        sessionStorage.setItem(`attendance-link:${sessionId}`, JSON.stringify(result));
        sessionStorage.setItem(`attendance-projection:${sessionId}`, result.projectionToken);
      } catch {
        // The current screen still carries both sharing links.
      }
      await Promise.all([
        utils.studentAttendance.status.invalidate({ sessionId }),
        utils.activity.invalidate(),
      ]);
    },
  });
  const close = trpc.studentAttendance.close.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.studentAttendance.status.invalidate({ sessionId }),
        utils.activity.invalidate(),
      ]);
    },
  });
  const active = status.windows.find((row) => row.active);
  const current = active && link?.id === active.id ? link : null;
  const url = current && origin ? `${origin}/presenca#${current.token}` : null;
  const projectionUrl =
    current && origin ? `${origin}/presenca/projecao#${current.projectionToken}` : null;
  const pending = disabled || open.isPending || close.isPending;
  function generate() {
    if (pending) return;
    let projectionToken = link?.projectionToken;
    try {
      projectionToken ??= sessionStorage.getItem(`attendance-projection:${sessionId}`) ?? undefined;
    } catch {
      // Opening a link can also issue a fresh projection access.
    }
    open.mutate({
      sessionId,
      minutes: status.format === "IN_PERSON" ? 5 : minutes,
      location: null,
      ...(projectionToken ? { projectionToken } : {}),
    });
  }
  return (
    <AttendanceShareControls
      status={{ format: status.format, restriction: status.restriction, active: Boolean(active) }}
      access={url && current ? { url, projectionUrl, expiresAt: current.expiresAt } : null}
      previousLink={Boolean(link)}
      pending={pending}
      generating={open.isPending}
      error={open.error?.message ?? close.error?.message}
      minutes={minutes}
      setMinutes={setMinutes}
      generate={generate}
      close={() => close.mutate({ sessionId })}
    />
  );
}
