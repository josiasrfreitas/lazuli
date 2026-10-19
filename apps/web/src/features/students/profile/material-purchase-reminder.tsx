import type { RouterOutputs } from "@lazuli/api";
import { CalendarClock } from "lucide-react";
import { formatDateOnlyBR } from "~/lib/format";

type Needs = RouterOutputs["finance"]["studentSummary"]["materialNeeds"];
/** Informational only: acquisitions remain available inside the contract, regardless of timing. */
export function MaterialPurchaseNotice({ needs }: { needs: Needs }) {
  if (!needs.length) return null;
  return (
    <div className="grid gap-2 border-t border-border pt-3">
      {needs.map((need) => (
        <div key={need.id} className="flex items-start gap-2 text-caption">
          <CalendarClock
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <p>
            <span className="font-medium">
              {need.stagePending ? "Conferir próximo estágio" : "Negociar próximo material"}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {need.currentStage} · {need.timing === "due" ? "fim previsto" : "planejamento até"}{" "}
              {formatDateOnlyBR(need.plannedEndOn)}
              {need.nextStage
                ? ` · ${need.mode === "PERSONALIZED" ? "próximo livro previsto" : "próximo estágio"}: ${need.nextStage}`
                : " · destino ainda não definido na organização de turmas"}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}
