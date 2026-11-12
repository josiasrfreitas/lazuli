"use client";
import { useEffect, useRef, useState } from "react";
import { trpc } from "~/lib/trpc";
import { sendCapture } from "~/features/mobile-upload/mobile-page";
import type { MobileFileInput } from "~/features/mobile-upload/file-editor";
type Session = { id: string; token: string; expiresAt: Date };
export function useTeacherDocuments(teacherId?: string) {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = useRef<Promise<Session> | null>(null);
  const utils = trpc.useUtils();
  const create = trpc.teachers.uploads.create.useMutation();
  const close = trpc.teachers.uploads.close.useMutation();
  const closeRef = useRef(close.mutate);
  closeRef.current = close.mutate;
  const query = trpc.teachers.uploads.status.useQuery(
    { id: session?.id ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(session), refetchInterval: session ? 2000 : false },
  );
  const existing = trpc.teachers.files.useQuery(
    { id: teacherId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(teacherId) },
  );
  useEffect(() => {
    if (session) return () => closeRef.current({ id: session.id });
  }, [session]);
  async function ensureSession(): Promise<Session> {
    if (session && !query.data?.closed && session.expiresAt > new Date()) return session;
    if (creating.current) return creating.current;
    creating.current = create
      .mutateAsync(teacherId ? { teacherId } : {})
      .then((value) => {
        setSession(value);
        return value;
      })
      .finally(() => {
        creating.current = null;
      });
    return creating.current;
  }
  async function send(input: MobileFileInput): Promise<void> {
    const current = await ensureSession();
    await sendCapture("/api/teacher-capture", current.token, input);
    await utils.teachers.uploads.status.fetch({ id: current.id });
    await utils.teachers.files.invalidate();
  }
  return {
    session,
    busy,
    setBusy,
    ensureSession,
    send,
    query,
    refresh: async () => {
      if (session) await query.refetch();
      else await existing.refetch();
    },
    error: create.error?.message,
    files: query.data?.files ?? existing.data ?? [],
  };
}
export type TeacherDocuments = ReturnType<typeof useTeacherDocuments>;
