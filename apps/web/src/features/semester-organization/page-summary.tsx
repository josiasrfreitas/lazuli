import type { JSX as ReactJSX } from "react";
import type { SemesterBoard } from "./shared";

export function SemesterSummary({ board }: { board: SemesterBoard }): ReactJSX.Element {
  const published = board.placements.filter((row) => row.publishedAt).length;
  const ready = board.placements.filter(
    (row) => !row.publishedAt && row.blockers.length === 0,
  ).length;
  const pending = board.placements.filter((row) => row.blockers.length).length;
  const metrics = [
    [
      "Alunos publicados",
      published,
      `${board.plans.filter((plan) => plan.classId).length} turmas já abertas`,
    ],
    ["Prontos para publicar", ready, "Disponibilidade e percurso conferidos"],
    ["Com pendências", pending, "Acadêmicas, de horário ou de cadastro"],
    [
      "Alunos sem proposta",
      board.studentsTotal - board.studentsProposed,
      `De ${board.studentsTotal} alunos cadastrados`,
    ],
  ] as const;
  return (
    <section
      aria-label="Resumo da organização"
      className="grid grid-cols-2 gap-x-5 gap-y-6 border-y border-border py-5 lg:grid-cols-4"
    >
      {metrics.map(([label, value, detail], index) => (
        <div key={label} className="grid content-start gap-1.5">
          <p className="text-caption text-muted-foreground">{label}</p>
          <p
            className={
              index === 0
                ? "font-numeric text-h2 font-semibold tabular-nums text-interactive"
                : "font-numeric text-h2 font-semibold tabular-nums text-heading"
            }
          >
            {value}
          </p>
          <p className="text-micro text-muted-foreground">{detail}</p>
        </div>
      ))}
    </section>
  );
}
