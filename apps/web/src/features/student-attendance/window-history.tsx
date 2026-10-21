import type { ReactElement } from "react";
import type { AttendanceStatus } from "./staff-section";
export function AttendanceWindowHistory({
  windows,
}: {
  windows: AttendanceStatus["windows"];
}): ReactElement | null {
  if (windows.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">Links recentes</summary>
      <ol className="mt-3 grid gap-3">
        {windows.map((window) => (
          <li key={window.id} className="grid gap-1 border-l border-border pl-3">
            <p>
              Aberto por {window.openedBy.name} · {dateTime(window.openedAt)}
            </p>
            <p className="text-caption text-muted-foreground">
              Validade até {dateTime(window.expiresAt)}
            </p>
            {window.closedAt ? (
              <p className="text-caption text-muted-foreground">
                Encerrado por {window.closedBy?.name ?? "Autoria não registrada"} ·{" "}
                {dateTime(window.closedAt)}
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">
                {window.active ? "Recebendo declarações" : "Prazo encerrado"}
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-caption text-muted-foreground">
        Até 20 links mais recentes deste encontro.
      </p>
    </details>
  );
}
function dateTime(date: Date): string {
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
