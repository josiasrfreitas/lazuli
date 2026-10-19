"use client";

import type { ReactElement } from "react";
import { ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogPortal,
  DialogTrigger,
} from "@lazuli/ui";
import { StudentAcademicProgress } from "~/features/assessments/student-progress";

import styles from "./student-profile.module.css";

type Props = {
  studentId: string;
  studentName: string;
  progressId?: string | undefined;
  triggerLabel?: string;
  triggerValue?: string;
};

export function StudentAssessmentsDialog({
  studentId,
  studentName,
  progressId,
  triggerLabel = "Ver avaliações e notas",
  triggerValue,
}: Props): ReactElement {
  return (
    <Dialog>
      <DialogTrigger
        render={
          triggerValue !== undefined ? (
            <button
              type="button"
              className="inline-flex min-h-8 cursor-pointer items-center justify-end gap-1 rounded-sm font-numeric tabular-nums text-foreground transition-colors hover:text-interactive focus-visible:outline-none focus-visible:shadow-focus"
              aria-label={`${triggerLabel} de ${studentName}`}
              title={triggerLabel}
            />
          ) : (
            <Button
              variant="link"
              size="inline"
              className={styles.detailLink}
              aria-label={`${triggerLabel} de ${studentName}`}
            />
          )
        }
      >
        {triggerValue !== undefined ? (
          <>
            {triggerValue}
            <ArrowUpRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
          </>
        ) : (
          <>
            <ChartNoAxesCombined aria-hidden="true" />
            {triggerLabel}
          </>
        )}
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="h-160 md:max-w-5xl">
          <StudentAcademicProgress
            studentId={studentId}
            studentName={studentName}
            initialProgressId={progressId}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
