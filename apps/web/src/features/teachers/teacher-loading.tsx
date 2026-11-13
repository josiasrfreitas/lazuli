import type { ReactElement, ReactNode } from "react";
import { BookOpen, Clock3, Mail, Pencil, MoreHorizontal } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";

import styles from "./teacher-overview.module.css";

const SKELETON_ROW_COUNT = 4;

export function TeacherHeaderLoading({ navigation }: { navigation?: ReactNode }): ReactElement {
  return (
    <header className={styles.teacherHeader} aria-label="Carregando professor" aria-busy="true">
      <div className={styles.teacherIdentity}>
        <InlineSkeleton className="size-10 shrink-0" />
        <InlineSkeleton shape="block" className="h-6 w-48 max-w-full" />
      </div>
      <div className={styles.teacherActions}>
        <InlineSkeleton shape="block" className="h-5 w-12" />
        <Button variant="ghost" size="icon-sm" aria-label="Editar cadastro" disabled>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Mais ações do professor" disabled>
          <MoreHorizontal />
        </Button>
      </div>
      <span className={styles.email}>
        <Mail aria-hidden="true" />
        <InlineSkeleton className="w-40 max-w-full" />
      </span>
      <span className={styles.loadingAccess}>
        <InlineSkeleton shape="block" className="h-5 w-full" />
      </span>
      <div className={styles.navigation}>{navigation}</div>
    </header>
  );
}

export function TeacherClassesLoading(): ReactElement {
  return (
    <ul className="grid gap-3 lg:grid-cols-2" aria-label="Carregando turmas" aria-busy="true">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => index).map((item) => (
        <li
          key={item}
          className="flex items-start gap-3 rounded-md border border-border bg-card p-4"
          aria-hidden="true"
        >
          <BookOpen className="mt-1 size-5 shrink-0 text-muted-foreground" />
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <InlineSkeleton className="h-5 w-40" />
              <InlineSkeleton className="h-5 w-12" />
            </div>
            <InlineSkeleton className="h-4 w-56 max-w-full" />
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-muted-foreground" />
              <InlineSkeleton className="h-4 w-32" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
