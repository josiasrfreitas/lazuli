"use client";
import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import { useRef, useState, type RefObject, type FormEvent } from "react";
import { employeeFields } from "@lazuli/validators";
import { useScrollToError } from "~/lib/scroll-to-error";
import { trpc } from "~/lib/trpc";
import { maskPhoneBR } from "~/lib/masks";

export type Employee = RouterOutputs["employees"]["byId"];
type EmployeeInput = RouterInputs["employees"]["save"];
export type TeacherDraft = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  isEnabled: boolean;
  area: EmployeeInput["area"] | null;
  jobTitle: string;
  role: EmployeeInput["role"];
  teaches: boolean;
  employmentType: NonNullable<EmployeeInput["employmentType"]> | null;
  notes: string;
};
export type TeacherFieldProps = {
  draft: TeacherDraft;
  errors: Record<string, string>;
  change: <Key extends keyof TeacherDraft>(key: Key, value: TeacherDraft[Key]) => void;
};

function employeeDraft(employee?: Employee): TeacherDraft {
  const base: TeacherDraft = {
    name: "",
    email: "",
    phone: "",
    cpf: "",
    isEnabled: false,
    area: null,
    jobTitle: "",
    role: "SECRETARY",
    teaches: false,
    employmentType: null,
    notes: "",
  };
  if (!employee) return base;
  const profile = employee.employeeProfile;
  const teaching = employee.teacherProfile;
  return {
    ...base,
    ...employeeContact(profile),
    name: employee.name,
    email: employee.email,
    isEnabled: employee.isEnabled,
    role: employee.role,
    teaches: Boolean(teaching && !teaching.deletedAt),
    notes: teaching?.notes ?? "",
  };
}
function employeeContact(
  profile: Employee["employeeProfile"],
): Pick<TeacherDraft, "area" | "jobTitle" | "cpf" | "employmentType" | "phone"> {
  if (!profile) return { area: null, jobTitle: "", cpf: "", employmentType: null, phone: "" };
  return {
    area: profile.area,
    jobTitle: profile.jobTitle ?? "",
    cpf: profile.cpf ?? "",
    employmentType: profile.employmentType as TeacherDraft["employmentType"],
    phone: maskPhoneBR(profile.phone ?? ""),
  };
}
type TeacherForm = TeacherFieldProps & {
  body: RefObject<HTMLDivElement | null>;
  first: RefObject<HTMLInputElement | null>;
  pending: boolean;
  failure: string | null;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};
export function useTeacherForm({
  teacher,
  onClose,
  documentSessionId,
}: {
  teacher: Employee | undefined;
  onClose: () => void;
  documentSessionId?: string | undefined;
}): TeacherForm {
  const [draft, setDraft] = useState(() => employeeDraft(teacher));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const first = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const save = trpc.employees.save.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.employees.invalidate(),
        utils.teachers.invalidate(),
        utils.classes.formOptions.invalidate(),
      ]);
      onClose();
    },
  });
  function change<Key extends keyof TeacherDraft>(key: Key, value: TeacherDraft[Key]): void {
    if (save.isPending) return;
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    save.reset();
  }
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = employeeFields.safeParse({ ...draft, documentSessionId });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.path[0] === "area" ? "Selecione a área." : issue.message,
          ]),
        ),
      );
      setRevision((value) => value + 1);
      return;
    }
    save.mutate({ ...parsed.data, ...(teacher ? { id: teacher.id } : {}) });
  }
  return {
    draft,
    errors,
    body,
    first,
    pending: save.isPending,
    change,
    submit,
    failure: save.error?.message ?? null,
  };
}
