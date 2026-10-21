"use client";
import { useEffect, useState } from "react";
import { attendanceTokenSchema } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { attendanceBrowserId } from "./browser";
export type LinkInfo = RouterOutputs["studentAttendance"]["inspect"];
export type Receipt = { name: string; submittedAt: Date };
export type PublicLink = {
  token: string;
  loaded: boolean;
  invalid: boolean;
  info: LinkInfo | undefined;
  receipt: Receipt | null | undefined;
  pending: boolean;
  error: { message: string } | null;
  retry: () => void;
};
export function usePublicLink(): PublicLink {
  const [link, setLink] = useState({ token: "", loaded: false, invalid: false });
  const inspect = trpc.studentAttendance.inspect.useMutation();
  const receipt = trpc.studentAttendance.receipt.useMutation();
  const { mutate: inspectLink, reset: resetInspect } = inspect;
  const { mutate: readReceipt, reset: resetReceipt } = receipt;
  useEffect(() => {
    const read = (): void => {
      const token = globalThis.location.hash.slice(1);
      const valid = attendanceTokenSchema.safeParse({ token }).success;
      resetInspect();
      resetReceipt();
      setLink({ token, loaded: true, invalid: Boolean(token) && !valid });
      if (!valid) return;
      inspectLink({ token });
      try {
        readReceipt({ token, browserId: attendanceBrowserId() });
      } catch {
        /* Sending explains unavailable storage; browsing remains available. */
      }
    };
    read();
    globalThis.addEventListener("hashchange", read);
    return () => globalThis.removeEventListener("hashchange", read);
  }, [inspectLink, readReceipt, resetInspect, resetReceipt]);
  return {
    ...link,
    info: inspect.data,
    receipt: receipt.data,
    pending: inspect.isPending || receipt.isPending,
    error: inspect.error,
    retry: () => inspectLink({ token: link.token }),
  };
}
