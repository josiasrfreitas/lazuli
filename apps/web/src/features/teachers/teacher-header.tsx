import type { RouterOutputs } from "@lazuli/api";
import { MoreHorizontal, Pencil } from "lucide-react";
import { Avatar, Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
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
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Avatar name={teacher.name} colorKey={teacher.id} />
          <h1 className="break-words font-display text-h2 font-semibold">{teacher.name}</h1>
          <TeacherStatus departure={teacher.teacherProfile?.departureDate} today={teacher.today} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          <span className="break-all">{teacher.email}</span>
          <span aria-hidden="true">|</span>
          <span>{enabled ? "Acesso ao sistema habilitado" : "Sem acesso ao sistema"}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-compact-responsive"
            onClick={onEdit}
            aria-label="Editar cadastro"
            title="Editar cadastro"
          >
            <Pencil aria-hidden="true" />
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
      </div>
    </header>
  );
}
