import type { ReactElement } from "react";
import { BookOpen, Clock3, Pencil, MoreHorizontal } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";

export function TeacherHeaderLoading(): ReactElement {
  return (
    <header
      className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4"
      aria-busy="true"
      aria-label="Carregando professor"
    >
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <InlineSkeleton className="size-8" />
          <InlineSkeleton className="h-8 w-56 max-w-full" />
          <InlineSkeleton className="h-5 w-16" />
        </div>
        <div className="flex flex-wrap gap-3">
          <InlineSkeleton className="h-4 w-48" />
          <InlineSkeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-compact-responsive"
          aria-label="Editar cadastro"
          disabled
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-compact-responsive"
          aria-label="Mais ações do professor"
          disabled
        >
          <MoreHorizontal />
        </Button>
      </div>
    </header>
  );
}

export function TeacherClassesLoading(): ReactElement {
  return (
    <ul className="grid gap-3 lg:grid-cols-2" aria-label="Carregando turmas" aria-busy="true">
      {[0, 1, 2, 3].map((item) => (
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
