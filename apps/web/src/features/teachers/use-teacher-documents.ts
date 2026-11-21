"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { trpc, type QueryResult } from "~/lib/trpc";
import { sendCapture } from "~/features/mobile-upload/mobile-page";
import type { MobileFileInput } from "~/features/mobile-upload/file-editor";
import type { RouterOutputs } from "@lazuli/api";
const SESSION_POLL_MS = 2000;
type TeacherQueries = {
  query: QueryResult<RouterOutputs["teachers"]["uploads"]["status"]>;
  existing: QueryResult<RouterOutputs["teachers"]["files"]>;
};
type Session = { id: string; token: string; expiresAt: Date };
export function useTeacherDocuments(teacherId?: string): TeacherDocuments {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = useRef<Promise<Session> | null>(null);
  const utils = trpc.useUtils();
  const create = trpc.teachers.uploads.create.useMutation();
  const renew = trpc.teachers.uploads.renew.useMutation();
  const close = trpc.teachers.uploads.close.useMutation();
  const closeRef = useRef(close.mutate);
  closeRef.current = close.mutate;
  const { query, existing } = useTeacherQueries({ teacherId, session });
  const sessionFiles = query.data?.files;
  useEffect(() => {
    if (teacherId && sessionFiles) utils.teachers.files.setData({ id: teacherId }, sessionFiles);
  }, [teacherId, sessionFiles, utils]);
  const sessionId = session?.id;
  useEffect(() => {
    if (sessionId) return () => closeRef.current({ id: sessionId });
  }, [sessionId]);
  async function ensureSession(): Promise<Session> {
    if (session && !query.data?.closed && session.expiresAt > new Date()) return session;
    if (creating.current) return creating.current;
    creating.current = (
      session
        ? renew.mutateAsync({ id: session.id })
        : create.mutateAsync(teacherId ? { teacherId } : {})
    )
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
    await sendCapture({ endpoint: "/api/teacher-capture", token: current.token }, input);
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
      if (teacherId) await existing.refetch();
    },
    ...documentState({ teacherId, session, query, existing }),
    error: renew.error?.message ?? create.error?.message,
  };
}
export type TeacherDocuments = {
  session: Session | null;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  ensureSession: () => Promise<Session>;
  send: (input: MobileFileInput) => Promise<void>;
  query: TeacherQueries["query"];
  refresh: () => Promise<void>;
  loading: boolean;
  loadError: boolean;
  error: string | undefined;
  files: RouterOutputs["teachers"]["uploads"]["status"]["files"];
};

function useTeacherQueries({
  teacherId,
  session,
}: {
  teacherId: string | undefined;
  session: Session | null;
}): TeacherQueries {
  const query = trpc.teachers.uploads.status.useQuery(
    { id: session?.id ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(session), refetchInterval: session ? SESSION_POLL_MS : false },
  );
  const existing = trpc.teachers.files.useQuery(
    { id: teacherId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(teacherId), staleTime: 60_000 },
  );
  return { query, existing };
}

function documentState({
  teacherId,
  session,
  query,
  existing,
}: TeacherQueries & { teacherId: string | undefined; session: Session | null }): Pick<
  TeacherDocuments,
  "loading" | "loadError" | "files"
> {
  return {
    loading: Boolean(teacherId) && existing.isPending && !query.data,
    loadError: existing.isError || (Boolean(session) && query.isError),
    files: query.data?.files ?? existing.data ?? [],
  };
}
