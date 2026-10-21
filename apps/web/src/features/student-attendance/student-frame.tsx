import type { ReactNode, ReactElement } from "react";

export function StudentAttendanceFrame({
  children,
  lesson,
}: {
  children: ReactNode;
  lesson?: { className: string; startTime: string; endTime: string } | undefined;
}): ReactElement {
  return (
    <main className="grid min-h-dvh content-start bg-background px-4 py-6 sm:content-center sm:py-10">
      <div className="mx-auto grid w-full max-w-md gap-7">
        <header className="flex items-center gap-2.5">
          <img
            src="/brand/lazuli-symbol-small-mono-navy.svg"
            alt=""
            className="size-7 dark:hidden"
          />
          <img
            src="/brand/lazuli-symbol-small-mono-white.svg"
            alt=""
            className="hidden size-7 dark:block"
          />
          <span className="font-display text-sm font-semibold tracking-widest text-heading">
            LAZULI
          </span>
        </header>
        <section className="grid min-w-0 gap-5">
          <div className="grid gap-1.5">
            <h1 className="font-display text-h2 font-semibold text-heading">
              Confirme sua presença
            </h1>
            {lesson && (
              <p className="text-caption text-muted-foreground">
                {lesson.className} · {lesson.startTime}–{lesson.endTime}
              </p>
            )}
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
