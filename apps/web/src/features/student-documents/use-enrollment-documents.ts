import { useEffect, useRef, useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { documentPrefill } from "./prefill";
import type { Dispatch, SetStateAction } from "react";
import { trpc } from "~/lib/trpc";
import type { EnrollmentIdentity, EnrollmentFlow } from "../students/new-student/new-student-state";
import type { NewStudentFieldName } from "../students/new-student/reducer";
import type { DocumentDefinition } from "./model";
const POLL_MS = 2000;
type Session = { id: string; token: string };
export type DocumentSelection = { document: DocumentDefinition; file?: File };
export type EnrollmentDocuments = {
  extras: DocumentDefinition[];
  setExtras: Dispatch<SetStateAction<DocumentDefinition[]>>;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  selection: DocumentSelection | null;
  setSelection: Dispatch<SetStateAction<DocumentSelection | null>>;
  captureBusy: boolean;
  setCaptureBusy: Dispatch<SetStateAction<boolean>>;
  session: Session | null;
  create: ReturnType<typeof trpc.studentDocuments.create.useMutation>;
  query: {
    data: RouterOutputs["studentDocuments"]["status"] | undefined;
    isError: boolean;
    refetch: () => Promise<object>;
  };
  ensureSession: () => Promise<Session>;
  dispatch: EnrollmentIdentity["dispatch"];
};
export function useEnrollmentDocuments({
  identity,
  flow,
  studentId,
}: {
  identity: EnrollmentIdentity;
  flow: EnrollmentFlow;
  studentId: string | undefined;
}): EnrollmentDocuments {
  const [open, setOpen] = useState(false);
  const [extras, setExtras] = useState<DocumentDefinition[]>([]);
  const [selection, setSelection] = useState<DocumentSelection | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const { session, create, ensureSession } = useDocumentSession(studentId);
  const query = trpc.studentDocuments.status.useQuery(
    { id: session?.id ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(session), refetchInterval: POLL_MS },
  );
  useDocumentSessionLifecycle({
    sessionId: session?.id,
    files: query.data?.files,
    setDirty: flow.setDirty,
  });
  const { touched, dispatch } = useDocumentDraftDispatch(identity);
  useDocumentPrefill({ identity, flow, files: query.data?.files, touched });
  return {
    extras,
    setExtras,
    open,
    setOpen,
    selection,
    setSelection,
    captureBusy,
    setCaptureBusy,
    session,
    create,
    query,
    ensureSession,
    dispatch,
  };
}

function useDocumentSession(
  studentId: string | undefined,
): Pick<EnrollmentDocuments, "session" | "create" | "ensureSession"> {
  const creating = useRef<Promise<Session> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const create = trpc.studentDocuments.create.useMutation();
  async function ensureSession(): Promise<Session> {
    if (session) return session;
    if (creating.current) return creating.current;
    creating.current = create
      .mutateAsync(studentId ? { studentId } : {})
      .then((value) => {
        setSession(value);
        return value;
      })
      .finally(() => {
        creating.current = null;
      });
    return creating.current;
  }
  const ensureRef = useRef(ensureSession);
  ensureRef.current = ensureSession;
  useEffect(() => {
    if (studentId)
      void ensureRef.current().catch(() => {
        /* Upload and QR actions allow retry. */
      });
  }, [studentId]);
  return { session, create, ensureSession };
}

function useDocumentDraftDispatch(identity: EnrollmentIdentity): {
  touched: Set<NewStudentFieldName>;
  dispatch: EnrollmentIdentity["dispatch"];
} {
  const touched = useRef(new Set<NewStudentFieldName>());
  const dispatch: EnrollmentIdentity["dispatch"] = (action) => {
    if (action.type === "fieldChanged") touched.current.add(action.field);
    identity.dispatch(action);
  };
  return { touched: touched.current, dispatch };
}

function useDocumentPrefill({
  identity,
  flow,
  files,
  touched,
}: {
  identity: EnrollmentIdentity;
  flow: EnrollmentFlow;
  files: import("./prefill").DocumentRow[] | undefined;
  touched: Set<NewStudentFieldName>;
}): void {
  const applied = useRef(new Set<string>());
  const automatic = useRef(new Map<NewStudentFieldName, string>());
  const latest = useRef({ identity, flow });
  latest.current = { identity, flow };
  useEffect(() => {
    for (const file of files ?? []) {
      const key = `${file.id}:${file.updatedAt.toISOString()}`;
      if (file.status !== "READY" || applied.current.has(key)) continue;
      applied.current.add(key);
      const current = latest.current;
      for (const [field, value] of documentPrefill(file, {
        fields: current.identity.state.fields,
        touched,
        automatic: automatic.current,
      })) {
        automatic.current.set(field, value);
        current.identity.dispatch({ type: "fieldChanged", field, value });
        current.flow.setDirty(true);
      }
    }
  }, [files, touched]);
}

function useDocumentSessionLifecycle({
  sessionId,
  files,
  setDirty,
}: {
  sessionId: string | undefined;
  files: import("./prefill").DocumentRow[] | undefined;
  setDirty: Dispatch<SetStateAction<boolean>>;
}): void {
  const close = trpc.studentDocuments.close.useMutation();
  const closeRef = useRef(close.mutate);
  closeRef.current = close.mutate;
  useEffect(() => {
    if (!sessionId) return;
    return () => closeRef.current({ id: sessionId });
  }, [sessionId]);
  useEffect(() => {
    if (sessionId && files?.some((file) => file.sessionId === sessionId)) setDirty(true);
  }, [sessionId, files, setDirty]);
}
