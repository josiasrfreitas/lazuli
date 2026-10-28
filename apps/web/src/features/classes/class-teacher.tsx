import type { ReactElement } from "react";
import Link from "next/link";
import { ChevronDown, UserRoundX, ArrowRight } from "lucide-react";
import {
  Button,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { dateLabel } from "../teachers/format";

import styles from "./class-page.module.css";

type Detail = RouterOutputs["classes"]["byId"];

export function ClassTeacher({
  detail,
  onAssign,
}: {
  detail: Detail;
  onAssign: () => void;
}): ReactElement {
  if (!detail.currentTeacher)
    return (
      <div className={styles.missingTeacher}>
        <div>
          <UserRoundX aria-hidden="true" />
          <strong>Sem professor</strong>
        </div>
        <Button size="inline" variant="link" onClick={onAssign}>
          Definir professor <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    );
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="link" size="inline" />}>
        <span className="min-w-0 whitespace-normal break-words text-left">
          {detail.currentTeacher?.name ?? "Sem professor"}
        </span>
        <ChevronDown aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>Professor responsável</PopoverTitle>
        <div className="grid gap-3 pt-3">
          {detail.currentTeacher && (
            <Link
              className="text-sm text-interactive hover:underline"
              href={`/professores/${detail.currentTeacher.id}`}
            >
              Abrir perfil de {detail.currentTeacher.name}
            </Link>
          )}
          <PopoverClose render={<Button size="sm" variant="secondary" onClick={onAssign} />}>
            {detail.currentTeacher ? "Trocar professor" : "Atribuir professor"}
          </PopoverClose>
          {detail.teacherAssignments.length > 0 && (
            <details className="text-caption text-muted-foreground">
              <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:shadow-focus">
                Histórico docente
              </summary>
              <ol className="grid gap-2 pt-3">
                {detail.teacherAssignments.map((assignment) => (
                  <li key={assignment.id}>
                    {assignment.teacher.name}
                    <span className="block">Desde {dateLabel(assignment.effectiveDate)}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
