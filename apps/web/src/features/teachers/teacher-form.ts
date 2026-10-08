"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RouterOutputs } from "@lazuli/api";
import { teacherCreateInputSchema } from "@lazuli/validators";
import { useScrollToError } from "~/lib/scroll-to-error";
import { trpc, type ClientError } from "~/lib/trpc";
type Teacher = RouterOutputs["teachers"]["byId"];
export function useTeacherForm(teacher: Teacher | undefined, onClose: () => void) {
  const departed = Boolean(
    teacher?.teacherProfile?.departureDate &&
    teacher.teacherProfile.departureDate.toISOString().slice(0, 10) <= teacher.today,
  );
  const [draft, setDraft] = useState({
    name: teacher?.name ?? "",
    email: teacher?.email ?? "",
    cpf: teacher?.teacherProfile?.cpf ?? "",
    isEnabled: teacher?.isEnabled ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const first = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const router = useRouter();
  const onSuccess = async (result: { id: string }) => {
    await Promise.all([utils.teachers.invalidate(), utils.classes.formOptions.invalidate()]);
    onClose();
    if (!teacher) router.push(`/professores/${result.id}`);
  };
  const onError = (error: ClientError) => {
    setFailure(error.message);
    setErrors(
      Object.fromEntries(
        Object.entries(error.data?.zodError?.fieldErrors ?? {}).map(([key, values]) => [
          key,
          values?.[0] ?? "",
        ]),
      ),
    );
    setRevision((value) => value + 1);
  };
  const create = trpc.teachers.create.useMutation({ onSuccess, onError });
  const update = trpc.teachers.update.useMutation({ onSuccess, onError });
  const pending = create.isPending || update.isPending;
  function change<Key extends keyof typeof draft>(key: Key, value: (typeof draft)[Key]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setFailure(null);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = teacherCreateInputSchema.safeParse(draft);
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
  return { departed, draft, errors, failure, body, first, pending, change, submit };
}
