"use client";
import { useEffect, useRef, useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { currentAttendanceLocation } from "./location";
import { attendanceBrowserId } from "./browser";
import type { LinkInfo, Receipt } from "./public-link";
const MIN_NAME_LENGTH = 3;
const SEARCH_DELAY_MS = 200;
type Matches = RouterOutputs["studentAttendance"]["search"];
type SearchState = { matches: Matches | null; error: string | null } | null;
function useIdentity(token: string): Identity {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<SearchState>(null);
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const { mutateAsync: search } = trpc.studentAttendance.search.useMutation();
  useEffect(() => {
    if (name.trim().length < MIN_NAME_LENGTH) return;
    let active = true;
    const current = version.current;
    const timer = globalThis.setTimeout(() => {
      void search({ token, name: name.trim() }).then(
        (matches) => {
          if (!active || current !== version.current) return;
          setResult({ matches, error: null });
          setSelected(matches.exactId ?? "");
        },
        (error: Error) => {
          if (active && current === version.current)
            setResult({ matches: null, error: searchError(error) });
        },
      );
    }, SEARCH_DELAY_MS);
    return () => {
      active = false;
      globalThis.clearTimeout(timer);
    };
  }, [name, token, search, retry]);
  return {
    name,
    selected,
    setSelected,
    result,
    searching: name.trim().length >= MIN_NAME_LENGTH && !result,
    change: (value) => {
      version.current += 1;
      setName(value);
      setSelected("");
      setResult(null);
    },
    retry: () => {
      version.current += 1;
      setResult(null);
      setRetry((value) => value + 1);
    },
  };
}
type Identity = {
  name: string;
  selected: string;
  setSelected: (id: string) => void;
  result: SearchState;
  searching: boolean;
  change: (name: string) => void;
  retry: () => void;
};
export type DeclarationModel = Identity & {
  format: LinkInfo["format"];
  receipt: Receipt | undefined;
  error: string | null;
  pending: boolean;
  locating: boolean;
  sending: boolean;
  canSubmit: boolean;
  send: () => Promise<void>;
};
export function useDeclaration(token: string, info: LinkInfo): DeclarationModel {
  const identity = useIdentity(token);
  const submit = trpc.studentAttendance.submit.useMutation();
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const pending = submit.isPending || locating;
  async function send(): Promise<void> {
    setLocationError(null);
    setLocating(true);
    try {
      const location = info.format === "IN_PERSON" ? await currentAttendanceLocation() : null;
      const browserId = attendanceBrowserId();
      await submit.mutateAsync({
        token,
        name: identity.name.trim(),
        enrollmentId: identity.selected,
        location,
        browserId,
      });
    } catch (error) {
      setLocationError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar. Tente novamente ou peça a chamada manual.",
      );
    } finally {
      setLocating(false);
    }
  }
  return {
    ...identity,
    format: info.format,
    receipt: submit.data,
    change: (value) => {
      identity.change(value);
      submit.reset();
      setLocationError(null);
    },
    error: locationError ?? submit.error?.message ?? null,
    pending,
    locating,
    sending: submit.isPending,
    canSubmit: !pending && identityReady(identity),
    send,
  };
}

function searchError(error: Error): string {
  return error instanceof Error ? error.message : "Não foi possível buscar seu nome.";
}
function identityReady(identity: Identity): boolean {
  return (
    !identity.searching &&
    Boolean(
      identity.result?.matches?.options.some(
        (person) => person.id === identity.selected && !person.manualRequired,
      ),
    )
  );
}
