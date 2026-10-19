"use client";
import { useEffect, type ReactElement } from "react";
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
  const href = studentId ? studentFollowUpHref(studentId, selection) : null;
  useEffect(() => {
    if (href) router.replace(href);
  }, [href, router]);
  return (
    <div className="p-6">
      <QueryState pending={pending || Boolean(href)} error={error} retry={retry} />
    </div>
  );
}
