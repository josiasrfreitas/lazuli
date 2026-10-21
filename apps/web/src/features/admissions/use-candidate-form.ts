"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "~/lib/trpc";
import { useScrollToError } from "~/lib/scroll-to-error";
import { initialCandidateDraft, parseCandidateDraft, type CandidateDraft } from "./candidate-model";
import type { Candidate } from "./labels";
export function useCandidateForm(candidate: Candidate | undefined, startAtAvailability: boolean) {
  const [draft, setDraft] = useState(() => initialCandidateDraft(candidate));
  const [step, setStep] = useState(startAtAvailability ? 1 : 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  useEffect(() => {
    if (step === 1) body.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [step, body]);
  const change = <Key extends keyof CandidateDraft>(key: Key, value: CandidateDraft[Key]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => field !== key && !field.startsWith(`${key}.`)),
      ),
    );
  };
  const validate = () => {
    const parsed = parseCandidateDraft(draft);
    let next = parsed.success
      ? {}
      : Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        );
    if (step === 0)
      next = Object.fromEntries(
        Object.entries(next).filter(([field]) => ["fullName", "phone", "email"].includes(field)),
      );
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setRevision((value) => value + 1);
      return null;
    }
    if (step === 0) {
      setStep(1);
      return null;
    }
    return parsed.success ? parsed.data : null;
  };
  return { draft, step, setStep, errors, body, change, validate };
}
export function useCandidateSave(id: string, editing: boolean, onClose: () => void) {
  const utils = trpc.useUtils();
  const router = useRouter();
  return trpc.admissions.save.useMutation({
    onSuccess: async () => {
      await utils.admissions.invalidate();
      onClose();
      if (!editing) router.push(`/interessados/${id}`);
    },
  });
}
