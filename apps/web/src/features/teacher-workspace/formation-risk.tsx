"use client";
import { useState, type ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { CaseForm } from "~/features/class-organization/case-form";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { trpc } from "~/lib/trpc";

export function TeacherFormationRisk({
  studentId,
  name,
}: {
  studentId: string;
  name: string;
}): ReactElement | null {
  const placements = trpc.teacherWorkspace.formationCases.useQuery({ studentId });
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState("");
  const row = placements.data?.find((item) => item.id === selected);
  if (placements.isError)
    return (
      <Button size="sm" variant="link" onClick={() => void placements.refetch()}>
        Tentar carregar vínculos da Formação
      </Button>
    );
  if (!placements.data?.length) return null;
  return (
    <section aria-label="Continuidade na turma" className="grid gap-2">
      <h3 className="font-semibold">Continuidade na turma</h3>
      {placements.data.map((item) => (
        <div key={item.id} className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {[item.semester.name, item.stage?.internalCode].filter(Boolean).join(" · ")}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFeedback("");
                setSelected(item.id);
              }}
            >
              Sinalizar risco de saída
            </Button>
          </div>
          {item.caseEvents.map((signal) => (
            <details key={signal.createdAt.toISOString()}>
              <summary>
                Seu último relato · {formatDateOnlyBR(toDateOnlySaoPaulo(signal.createdAt))}
              </summary>
              <p className="whitespace-pre-line">{signal.narrative}</p>
              <p>
                {signal.verbalReport
                  ? "O aluno ou a família falou em sair."
                  : "Sem manifestação verbal de saída."}
              </p>
            </details>
          ))}
        </div>
      ))}
      {feedback && <p role="status">{feedback}</p>}
      {row && (
        <CaseForm
          id={row.id}
          semesterId={row.semesterId}
          mode="teacher"
          description={`${name} · ${row.semester.name}`}
          onClose={() => setSelected("")}
          onSaved={async () => {
            setFeedback("Sinalização registrada na Formação.");
            await placements.refetch();
          }}
        />
      )}
    </section>
  );
}
