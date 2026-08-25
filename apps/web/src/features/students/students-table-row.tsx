import type { ReactElement, ReactNode } from "react";

import { MessageCircle } from "lucide-react";

import type { StudentListRow } from "@lazuli/validators";
import { Avatar, Badge, Button, cn, TableCell, TableRow } from "@lazuli/ui";

import { EM_DASH } from "~/lib/format";

import {
  attendanceCellVm,
  financeCellVm,
  whatsAppVm,
  type FactCellVm,
  type FactTone,
} from "./view-model";

const TONE_CLASSES: Record<FactTone, string> = {
  default: "",
  muted: "text-muted-foreground",
  success: "text-success",
  destructive: "text-destructive",
};

function FactCell({ vm }: { vm: FactCellVm }): ReactElement {
  return (
    <TableCell className={TONE_CLASSES[vm.tone]} numeric>
      <span className={cn(vm.numeric && "font-numeric")}>{vm.label}</span>
    </TableCell>
  );
}

function EnrollmentCell({ enrollment }: { enrollment: StudentListRow["enrollment"] }): ReactNode {
  if (enrollment === null) {
    return <TableCell className="text-muted-foreground">{EM_DASH}</TableCell>;
  }

  return (
    <TableCell>
      <div className="flex flex-col gap-0.5">
        <span className="font-numeric tabular-nums">{enrollment.classCode}</span>
        <span className="text-micro text-muted-foreground">{enrollment.scheduleLabel}</span>
      </div>
    </TableCell>
  );
}

function WhatsAppCell({ row }: { row: StudentListRow }): ReactElement {
  const whatsApp = whatsAppVm(row);

  if (whatsApp === null) {
    return <TableCell className="text-center text-muted-foreground">{EM_DASH}</TableCell>;
  }

  return (
    <TableCell className="text-center">
      <Button
        nativeButton={false}
        render={
          <a aria-label={whatsApp.label} href={whatsApp.url} rel="noreferrer" target="_blank" />
        }
        size="icon-sm"
        variant="ghost"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
      </Button>
    </TableCell>
  );
}

export function StudentsTableRow({ row }: { row: StudentListRow }): ReactElement {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar colorKey={row.id} name={row.fullName} size="sm" />
          <span className="font-medium text-foreground">{row.fullName}</span>
          {row.isMinor ? <Badge variant="neutral">menor</Badge> : null}
        </div>
      </TableCell>
      <EnrollmentCell enrollment={row.enrollment} />
      <TableCell>{row.enrollment?.teacherName ?? EM_DASH}</TableCell>
      <FactCell vm={attendanceCellVm(row.attendance)} />
      <FactCell vm={financeCellVm(row.finance)} />
      <WhatsAppCell row={row} />
    </TableRow>
  );
}
