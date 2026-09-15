import type { ReactElement, ReactNode } from "react";

import { MessageCircle } from "lucide-react";

import type { StudentListRow } from "@lazuli/validators";
import { Avatar, Badge, Button, cn, TableCell, TableRow } from "@lazuli/ui";

import { EM_DASH } from "~/lib/format";

import { attendanceCellVm, financeCellVm, whatsAppVm, type FactCellVm } from "./view-model";

function FactCell({ vm }: { vm: FactCellVm }): ReactElement {
  const content = <span className={cn(vm.numeric && "font-numeric")}>{vm.label}</span>;

  if (vm.tone === "muted") {
    return (
      <TableCell className="text-muted-foreground" numeric>
        {content}
      </TableCell>
    );
  }

  if (vm.tone === "success") {
    return (
      <TableCell className="text-success" numeric>
        {content}
      </TableCell>
    );
  }

  if (vm.tone === "destructive") {
    return (
      <TableCell className="text-destructive" numeric>
        {content}
      </TableCell>
    );
  }

  return <TableCell numeric>{content}</TableCell>;
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
    <TableCell
      className="text-center"
      // Contacting a student must not also open their preview panel.
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
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

export function StudentsTableRow({
  row,
  selected,
  onSelect,
}: {
  row: StudentListRow;
  selected: boolean;
  onSelect: (id: string) => void;
}): ReactElement {
  return (
    <TableRow
      className="cursor-pointer focus-visible:outline-none focus-visible:shadow-focus"
      onClick={() => {
        onSelect(row.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          onSelect(row.id);
        }
      }}
      selected={selected}
      tabIndex={0}
    >
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
