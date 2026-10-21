"use client";
import { useEffect, useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  attendanceTokenSchema,
  ONLINE_WINDOW_MINUTES,
  PRESENTIAL_WINDOW_MINUTES,
} from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import type { AttendanceStatus } from "./staff-section";
import { AttendanceShareControls } from "./share-controls";
type QrLink = RouterOutputs["studentAttendance"]["open"];
type StoredLink = Omit<QrLink, "expiresAt"> & { expiresAt: string };
type Minutes = (typeof ONLINE_WINDOW_MINUTES)[number];
type Props = { sessionId: string; status: AttendanceStatus; disabled: boolean };
function storeLink(sessionId: string, result: QrLink): void {
  try {
    sessionStorage.setItem(`attendance-link:${sessionId}`, JSON.stringify(result));
    sessionStorage.setItem(`attendance-projection:${sessionId}`, result.projectionToken);
  } catch {
    /* Current sharing works without storage. */
  }
}
function useStoredLink(sessionId: string): [QrLink | null, (link: QrLink) => void] {
  const [link, setLink] = useState<QrLink | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`attendance-link:${sessionId}`);
      if (!raw) return;
      const value = JSON.parse(raw) as StoredLink;
      if (
        typeof value.id === "string" &&
        attendanceTokenSchema.safeParse({ token: value.token }).success &&
        attendanceTokenSchema.safeParse({ token: value.projectionToken }).success &&
        Number.isFinite(new Date(value.expiresAt).getTime())
      )
        setLink({ ...value, expiresAt: new Date(value.expiresAt) });
    } catch {
      /* A replacement can always be generated. */
    }
  }, [sessionId]);
  return [
    link,
    (result) => {
      setLink(result);
      storeLink(sessionId, result);
    },
  ];
}
function useShareActions(props: Props): ShareActions {
  const [link, setLink] = useStoredLink(props.sessionId);
  const [minutes, setMinutes] = useState<Minutes>(ONLINE_WINDOW_MINUTES[0]);
  const utils = trpc.useUtils();
  const refresh = async (): Promise<void> => {
    await Promise.all([
      utils.studentAttendance.status.invalidate({ sessionId: props.sessionId }),
      utils.classRecords.detail.invalidate({ sessionId: props.sessionId }),
    ]);
  };
  const open = trpc.studentAttendance.open.useMutation({
    onSuccess: async (result) => {
      setLink(result);
      await refresh();
    },
  });
  const close = trpc.studentAttendance.close.useMutation({ onSuccess: refresh });
  const pending = props.disabled || open.isPending || close.isPending;
  function generate(): void {
    if (pending) return;
    let projectionToken = link?.projectionToken;
    try {
      projectionToken ??=
        sessionStorage.getItem(`attendance-projection:${props.sessionId}`) ?? undefined;
    } catch {
      /* A fresh projector access is issued without storage. */
    }
    open.mutate({
      sessionId: props.sessionId,
      minutes: props.status.format === "IN_PERSON" ? PRESENTIAL_WINDOW_MINUTES : minutes,
      location: null,
      ...(projectionToken ? { projectionToken } : {}),
    });
  }
  return {
    link,
    minutes,
    setMinutes,
    pending,
    generating: open.isPending,
    error: open.error?.message ?? close.error?.message,
    generate,
    close: () => close.mutate({ sessionId: props.sessionId }),
  };
}
type ShareActions = {
  link: QrLink | null;
  minutes: Minutes;
  setMinutes: (value: Minutes) => void;
  pending: boolean;
  generating: boolean;
  error: string | undefined;
  generate: () => void;
  close: () => void;
};
export function AttendanceSharePanel(props: Props): ReactElement {
  const actions = useShareActions(props);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(globalThis.location.origin), []);
  const active = props.status.windows.find((row) => row.active);
  const current = active && actions.link?.id === active.id ? actions.link : null;
  const access =
    current && origin
      ? {
          url: `${origin}/presenca#${current.token}`,
          projectionUrl: `${origin}/presenca/projecao#${current.projectionToken}`,
          expiresAt: current.expiresAt,
        }
      : null;
  return (
    <AttendanceShareControls
      {...actions}
      status={{
        format: props.status.format,
        restriction: props.status.restriction,
        active: Boolean(active),
      }}
      access={access}
      previousLink={Boolean(actions.link)}
    />
  );
}
