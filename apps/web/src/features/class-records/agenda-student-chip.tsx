import type { ReactElement } from "react";
import { UserRound, X } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import styles from "./calendar.module.css";

export function AgendaStudentChip({
  id,
  name,
  admin,
  onClear,
}: {
  id: string;
  name: string | undefined;
  admin: boolean;
  onClear: () => void;
}): ReactElement {
  const student = trpc.students.byId.useQuery({ id }, { enabled: admin && !name });
  const label = name ?? student.data?.contact.fullName ?? "Aluno selecionado";
  return (
    <div className={styles.studentChip}>
      <UserRound aria-hidden="true" />
      <span title={label}>{label}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remover filtro de aluno: ${label}`}
        onClick={onClear}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
