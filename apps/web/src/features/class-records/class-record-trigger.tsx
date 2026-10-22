"use client";
import type { JSX as ReactJSX } from "react";
import { BookOpen } from "lucide-react";

import { useState, type ReactNode } from "react";
import { Button } from "@lazuli/ui";
import { ClassRecordDialog } from "./class-record-dialog";

/** The same lesson consultation from agenda, class history and student history. */
export function ClassRecordTrigger({
  sessionId,
  children,
  label,
}: {
  sessionId: string;
  children: ReactNode;
  label?: string;
}): ReactJSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="link"
        size="inline"
        className="max-w-full"
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <BookOpen aria-hidden="true" />
        <span className="min-w-0 truncate">{children}</span>
      </Button>
      {open && <ClassRecordDialog id={sessionId} onClose={() => setOpen(false)} />}
    </>
  );
}
