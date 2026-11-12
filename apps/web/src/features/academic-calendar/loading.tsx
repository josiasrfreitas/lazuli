import { LoaderCircle } from "lucide-react";

export function AcademicCalendarLoading() {
  return (
    <section className="grid gap-4 p-4 md:px-8 md:py-6" aria-busy="true">
      <h1 className="font-display text-h3 text-heading">Calendário acadêmico</h1>
      <div
        className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground"
        role="status"
      >
        <LoaderCircle
          className="size-5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span className="text-caption">Carregando calendário…</span>
      </div>
    </section>
  );
}
