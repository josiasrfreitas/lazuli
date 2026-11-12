import type { ReactElement, ReactNode } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Check, Mail, MoreHorizontal, Pencil, X } from "lucide-react";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import { TeacherPhoto } from "./teacher-photo";
import styles from "./teacher-overview.module.css";
import { TeacherStatus } from "./teacher-status";

const ISO_DATE_LENGTH = 10;

export function TeacherHeader({
  teacher,
  onEdit,
  onDepart,
  navigation,
}: TeacherHeaderInput): ReactElement {
  const enabled =
    teacher.isEnabled &&
    (!teacher.teacherProfile?.departureDate ||
      teacher.teacherProfile.departureDate.toISOString().slice(0, ISO_DATE_LENGTH) > teacher.today);
  return (
    <header className={styles.teacherHeader}>
      <div className={styles.teacherIdentity}>
        <TeacherPhoto id={teacher.id} name={teacher.name} />
        <h1 title={teacher.name}>{teacher.name}</h1>
      </div>
      <div className={styles.teacherActions}>
        <TeacherStatus departure={teacher.teacherProfile?.departureDate} today={teacher.today} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="Editar cadastro"
          title="Editar cadastro"
        >
          <Pencil aria-hidden="true" />
        </Button>
        {!teacher.teacherProfile?.departureDate && <TeacherActions onDepart={onDepart} />}
      </div>
      <span className={styles.email} title={teacher.email}>
        <Mail aria-hidden="true" />
        <span>{teacher.email}</span>
      </span>
      <Badge
        variant={enabled ? "success" : "destructive"}
        title={enabled ? "Acesso ao sistema habilitado" : "Acesso ao sistema desabilitado"}
      >
        <span className={styles.access}>
          {enabled ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
          <span className={styles.accessLabel}>Acesso ao sistema</span>
          <span className="sr-only">{enabled ? " habilitado" : " desabilitado"}</span>
        </span>
      </Badge>
      <div className={styles.navigation}>{navigation}</div>
    </header>
  );
}

type TeacherActionsProps = { onDepart: () => void };
function TeacherActions(props: TeacherActionsProps): ReactElement {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Mais ações do professor" />}
      >
        <MoreHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end">
        <Button variant="ghost" size="compact-responsive" onClick={props.onDepart}>
          Encerrar atuação
        </Button>
      </PopoverContent>
    </Popover>
  );
}

type TeacherHeaderInput = {
  teacher: RouterOutputs["teachers"]["byId"];
  navigation?: ReactNode;
  onEdit: () => void;
  onDepart: () => void;
};
