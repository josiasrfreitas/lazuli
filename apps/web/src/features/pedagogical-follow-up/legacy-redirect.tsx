"use client";
import { useEffect, type ReactElement } from "react";
import { useContext } from "react";
import { TeacherViewContext, teacherViewHref } from "~/lib/teacher-view-navigation";
import { useRouter } from "next/navigation";
import { QueryState } from "./shared";
import { studentFollowUpHref, type FollowUpSelection } from "./student-navigation";
type Props = {
  studentId?: string | undefined;
  selection: FollowUpSelection;
  pending: boolean;
  error: { message: string } | null;
  retry: () => void;
};
export function LegacyFollowUpRedirect({
  studentId,
  selection,
  pending,
  error,
  retry,
}: Props): ReactElement {
  const router = useRouter();
  const teacher = useContext(TeacherViewContext);
  const href = studentId ? studentFollowUpHref(studentId, selection) : null;
  useEffect(() => {
    if (href) router.replace(teacherViewHref(href, teacher));
  }, [href, router, teacher]);
  return (
    <div className="p-6">
      <QueryState pending={pending || Boolean(href)} error={error} retry={retry} />
    </div>
  );
}
