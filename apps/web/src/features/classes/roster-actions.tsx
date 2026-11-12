import type { ReactElement } from "react";
import { MoreHorizontal, PauseCircle, Play } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger, PopoverClose } from "@lazuli/ui";
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
          <Button size="icon-sm" variant="ghost" aria-label={`Ações de ${row.student.fullName}`} />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" size="menu" showArrow={false}>
        <div className="grid max-w-64 gap-1 border-b border-border px-2 py-2">
          <p className="text-caption font-medium">{row.student.fullName}</p>
          <p className="text-caption text-muted-foreground">
            Entrada em {row.entryDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </p>
          <StudentMembershipDates row={row} />
        </div>
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
        <div className="grid pt-1">
          <PopoverClose render={<Button size="sm" variant="ghost" onClick={() => resume(row)} />}>
            <Play aria-hidden="true" /> Retomar matrícula
          </PopoverClose>
        </div>
      )}
      {canClose && (
        <div className="grid pt-1">
          <PopoverClose render={<Button size="sm" variant="ghost" onClick={() => close(row)} />}>
            <PauseCircle aria-hidden="true" /> Pausar ou encerrar vínculo
          </PopoverClose>
        </div>
      )}
    </>
  );
}
