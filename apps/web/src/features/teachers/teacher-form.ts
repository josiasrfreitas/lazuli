"use client";
import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import {
  type Dispatch,
  type SetStateAction,
  type RefObject,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { teacherCreateInputSchema } from "@lazuli/validators";
import { useScrollToError } from "~/lib/scroll-to-error";
import { trpc, type ClientError } from "~/lib/trpc";

import { parseDateBR } from "~/lib/masks";
const ISO_DATE_LENGTH = 10;
export type TeacherDraft = {
  name: string;
  email: string;
  cpf: string;
  isEnabled: boolean;
  employmentType: "CLT" | "PJ" | "AUTONOMOUS" | "OTHER" | null;
  weeklyHours: string;
  notes: string;
  vacationStart: string;
  vacationEnd: string;
};
export type TeacherFieldProps = {
  draft: TeacherDraft;
  errors: Record<string, string>;
  change: <Key extends keyof TeacherDraft>(key: Key, value: TeacherDraft[Key]) => void;
};
type UseTeacherFormResult = {
  departed: boolean;
  draft: TeacherDraft;
  errors: Record<string, string>;
  failure: string | null;
  body: RefObject<HTMLDivElement | null>;
  first: RefObject<HTMLInputElement | null>;
  pending: boolean;
  change: <Key extends keyof TeacherDraft>(key: Key, value: TeacherDraft[Key]) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};

type Teacher = RouterOutputs["teachers"]["byId"];
export function useTeacherForm(
  teacher: Teacher | undefined,
  onClose: () => void,
  documentSessionId?: string,
): UseTeacherFormResult {
  const departed = teacherDeparted(teacher);
  const [draft, setDraft] = useState(teacherDraft(teacher));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const first = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const router = useRouter();
  const onSuccess = async (result: { id: string }): Promise<void> => {
    await Promise.all([utils.teachers.invalidate(), utils.classes.formOptions.invalidate()]);
    onClose();
    if (!teacher) router.push(`/professores/${result.id}`);
  };
  const onError = (error: ClientError): void => {
    setFailure(error.message);
    setErrors(teacherFieldErrors(error));
    setRevision((value) => value + 1);
  };
  const create = trpc.teachers.create.useMutation({ onSuccess, onError });
  const update = trpc.teachers.update.useMutation({ onSuccess, onError });
  const pending = create.isPending || update.isPending;
  function change<Key extends keyof typeof draft>(key: Key, value: (typeof draft)[Key]): void {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "employmentType" && value !== "CLT"
        ? { vacationStart: "", vacationEnd: "" }
        : {}),
    }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setFailure(null);
  }
  const submit = (event: FormEvent<HTMLFormElement>): void =>
    submitTeacherForm(event, {
      pending,
      documentSessionId,
      draft,
      setErrors,
      setRevision,
      teacher,
      update,
      create,
    });
  return { departed, draft, errors, failure, body, first, pending, change, submit };
}

type SubmitTeacherFormContext = {
  documentSessionId: string | undefined;
  pending: boolean;
  draft: TeacherDraft;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
  setRevision: Dispatch<SetStateAction<number>>;
  teacher: Teacher | undefined;
  update: { mutate: (values: RouterInputs["teachers"]["update"]) => void };
  create: { mutate: (values: RouterInputs["teachers"]["create"]) => void };
};
function submitTeacherForm(
  event: FormEvent<HTMLFormElement>,
  {
    pending,
    draft,
    setErrors,
    setRevision,
    teacher,
    update,
    create,
    documentSessionId,
  }: SubmitTeacherFormContext,
): void {
  event.preventDefault();
  if (pending) return;
  const parsed = teacherCreateInputSchema.safeParse({
    ...draft,
    ...(documentSessionId ? { documentSessionId } : {}),
    weeklyHours: draft.weeklyHours.trim() ? Number(draft.weeklyHours.replace(",", ".")) : null,
    notes: draft.notes.trim() || null,
    vacationStart: draft.vacationStart ? (parseDateBR(draft.vacationStart) ?? "invalid") : null,
    vacationEnd: draft.vacationEnd ? (parseDateBR(draft.vacationEnd) ?? "invalid") : null,
  });
  if (!parsed.success) {
    setErrors(
      Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    );
    setRevision((value) => value + 1);
    return;
  }
  if (teacher) update.mutate({ ...parsed.data, id: teacher.id });
  else create.mutate(parsed.data);
}

function teacherDraft(teacher: Teacher | undefined): UseTeacherFormResult["draft"] {
  return {
    name: teacher?.name ?? "",
    email: teacher?.email ?? "",
    cpf: teacher?.teacherProfile?.cpf ?? "",
    isEnabled: teacher?.isEnabled ?? false,
    employmentType:
      (teacher?.teacherProfile?.employmentType as TeacherDraft["employmentType"]) ?? null,
    weeklyHours: teacher?.teacherProfile?.weeklyHours?.toString().replace(".", ",") ?? "",
    notes: teacher?.teacherProfile?.notes ?? "",
    vacationStart: displayDate(teacher?.teacherProfile?.vacationStart),
    vacationEnd: displayDate(teacher?.teacherProfile?.vacationEnd),
  };
}
function teacherDeparted(teacher: Teacher | undefined): boolean {
  return Boolean(
    teacher?.teacherProfile?.departureDate &&
    teacher.teacherProfile.departureDate.toISOString().slice(0, ISO_DATE_LENGTH) <= teacher.today,
  );
}
function teacherFieldErrors(error: ClientError): Record<string, string> {
  return Object.fromEntries(
    Object.entries(error.data?.zodError?.fieldErrors ?? {}).map(([key, values]) => [
      key,
      values?.[0] ?? "",
    ]),
  );
}

function displayDate(value: Date | null | undefined): string {
  return value?.toISOString().slice(0, ISO_DATE_LENGTH).split("-").reverse().join("/") ?? "";
}
