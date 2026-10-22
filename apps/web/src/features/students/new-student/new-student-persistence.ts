import { trpc } from "~/lib/trpc";
import type { EnrollmentFlow, IntakeInput } from "./new-student-state";

export type EnrollmentPersistence = {
  pending: boolean;
  persist: (input: IntakeInput) => Promise<void>;
};

export function useEnrollmentPersistence({
  flow,
  onCreated,
  onOpenChange,
}: {
  flow: EnrollmentFlow;
  onCreated: (id: string) => void;
  onOpenChange: (open: boolean) => void;
}): EnrollmentPersistence {
  const utils = trpc.useUtils();
  const enroll = trpc.students.enrollNew.useMutation();
  const resume = trpc.students.resumeIntake.useMutation();
  const persist = async (input: IntakeInput): Promise<void> => {
    if (flow.busy.current) return;
    flow.busy.current = true;
    flow.setError("");
    try {
      const result =
        "studentId" in input ? await resume.mutateAsync(input) : await enroll.mutateAsync(input);
      void Promise.all([
        utils.students.invalidate(),
        utils.admissions.invalidate(),
        utils.enrollment.invalidate(),
        utils.finance.invalidate(),
        utils.semesterOrganization.invalidate(),
      ]);
      onCreated(result.studentId);
      onOpenChange(false);
    } catch (error_) {
      flow.setError(
        error_ instanceof Error
          ? error_.message
          : "Não foi possível concluir o cadastro. Os dados continuam em rascunho.",
      );
    } finally {
      flow.busy.current = false;
    }
  };
  return { pending: enroll.isPending || resume.isPending, persist };
}
