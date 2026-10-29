"use client";
import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { RouterInputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { useScrollToError } from "~/lib/scroll-to-error";
import {
  initialCandidateDraft,
  parseCandidateDraft,
  type CandidateDraft,
  type CandidateFieldsProps,
} from "./candidate-model";
import type { Candidate } from "./labels";
type CandidateFormState = {
  draft: CandidateDraft;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  errors: Record<string, string>;
  body: RefObject<HTMLDivElement | null>;
  change: CandidateFieldsProps["change"];
  validate: () => RouterInputs["admissions"]["save"]["values"] | null;
};
export function useCandidateForm(
  candidate: Candidate | undefined,
  startAtCourse: boolean,
): CandidateFormState {
  const [draft, setDraft] = useState(() => initialCandidateDraft(candidate));
  const [step, setStep] = useState(startAtCourse ? 1 : 0);
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
  const validate = (): RouterInputs["admissions"]["save"]["values"] | null => {
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
export function useCandidateSave({
  id,
  editing,
  onClose,
}: {
  id: string;
  editing: boolean;
  onClose: () => void;
}): ReturnType<typeof trpc.admissions.save.useMutation> {
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
