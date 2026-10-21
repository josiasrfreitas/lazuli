import type { ReactElement } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
  PopoverTitle,
} from "@lazuli/ui";
import type { RosterRow } from "./roster-status";
function StudentMembershipDates({ row }: { row: RosterRow }): ReactElement {
  return (
    <>
      {row.exitDate && (
        <p className="mt-1 text-caption text-muted-foreground">
          Saída em {row.exitDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
      )}
      {row.actions[0] && (
        <p className="mt-1 text-caption text-muted-foreground">
          {row.actions[0].kind === "PAUSE" ? "Pausa" : "Saída"} em{" "}
          {row.actions[0].effectiveDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
      )}
    </>
  );
}

export function StudentActions({
  row,
  close,
  canClose,
  resume,
}: {
  row: RosterRow;
  close: (row: RosterRow) => void;
  resume?: ((row: RosterRow) => void) | undefined;
  canClose: boolean;
}): ReactElement {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Detalhes de ${row.student.fullName}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end">
        <PopoverTitle>{row.student.fullName}</PopoverTitle>
        <p className="mt-2 text-caption text-muted-foreground">
          Entrada em {row.entryDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
        <StudentMembershipDates row={row} />
        <StudentActionButtons row={row} close={close} resume={resume} canClose={canClose} />
      </PopoverContent>
    </Popover>
  );
}

function StudentActionButtons({
  row,
  close,
  resume,
  canClose,
}: {
  row: RosterRow;
  close: (row: RosterRow) => void;
  resume?: ((row: RosterRow) => void) | undefined;
  canClose: boolean;
}): ReactElement {
  return (
    <>
      {resume && (
        <div className="mt-3">
          <PopoverClose
            render={<Button size="sm" variant="secondary" onClick={() => resume(row)} />}
          >
            Retomar matrícula
          </PopoverClose>
        </div>
      )}
      {canClose && (
        <div className="mt-3">
          <PopoverClose
            render={<Button size="sm" variant="secondary" onClick={() => close(row)} />}
          >
            Pausar ou encerrar vínculo
          </PopoverClose>
        </div>
      )}
    </>
  );
}
