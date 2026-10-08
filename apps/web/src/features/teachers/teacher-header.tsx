import type { RouterOutputs } from "@lazuli/api";
import { MoreHorizontal } from "lucide-react";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import { TeacherStatus } from "./teacher-status";
export function TeacherHeader({
  teacher,
  onEdit,
  onDepart,
}: {
  teacher: RouterOutputs["teachers"]["byId"];
  onEdit: () => void;
  onDepart: () => void;
}) {
  const enabled =
    teacher.isEnabled &&
    (!teacher.teacherProfile?.departureDate ||
      teacher.teacherProfile.departureDate.toISOString().slice(0, 10) > teacher.today);
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
      <div className="grid min-w-0 gap-2">
        <h1 className="break-words font-display text-h2 font-semibold">{teacher.name}</h1>
        <p className="break-all text-caption text-muted-foreground">{teacher.email}</p>
        <div className="flex flex-wrap items-center gap-2">
          <TeacherStatus departure={teacher.teacherProfile?.departureDate} today={teacher.today} />
          <Badge variant="neutral">{enabled ? "Acesso habilitado" : "Sem acesso ao sistema"}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="compact-responsive" onClick={onEdit}>
          Editar cadastro
        </Button>
        {!teacher.teacherProfile?.departureDate && (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-compact-responsive"
                  aria-label="Mais ações do professor"
                />
              }
            >
              <MoreHorizontal />
            </PopoverTrigger>
            <PopoverContent align="end">
              <Button variant="ghost" size="compact-responsive" onClick={onDepart}>
                Encerrar atuação
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  );
}
