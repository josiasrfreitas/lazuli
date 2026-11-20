"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { FileOutput } from "lucide-react";
import { Button, type TableFilterField } from "@lazuli/ui";
import type { RouterInputs } from "@lazuli/api";
import type { TableExportRequest } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";

function description(field: TableFilterField): string {
  if (field.kind === "toggle") return field.checked ? "Sim" : "";
  if (field.kind === "options" || field.kind === "remote-options") {
    const options = field.kind === "options" ? field.options : field.selectedOptions;
    return field.selected.map((id) => options.find((o) => o.id === id)?.label ?? id).join(", ");
  }
  const format = (v: string) => (field.kind === "period" ? v.split("-").reverse().join("/") : v);
  return [field.from && "De " + format(field.from), field.to && "até " + format(field.to)]
    .filter(Boolean)
    .join(" ");
}

export function TableExportButton({
  source,
  fields = [],
  search = "",
  criteria = [],
}: {
  source: RouterInputs["reports"]["requestTableExport"]["source"];
  fields?: TableFilterField[];
  search?: string;
  criteria?: TableExportRequest["criteria"];
}): ReactElement {
  const { client } = trpc.useUtils();
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function download(): Promise<void> {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setFailed(false);
    setBusy(true);
    try {
      const selected: TableExportRequest["criteria"] = fields
        .map((field) => [field.label, description(field)] as [string, string])
        .filter(([, value]) => Boolean(value));
      if (search) selected.unshift(["Busca", search]);
      const { id } = await client.reports.requestTableExport.mutate({
        source,
        criteria: [...criteria, ...selected],
      });
      const deadline = Date.now() + 16 * 60_000;
      while (!current.signal.aborted) {
        const status = await client.reports.tableExportStatus.query(
          { id },
          { signal: current.signal },
        );
        if (status === "ready") {
          const response = await fetch("/api/table-exports/" + id, { signal: current.signal });
          if (!response.ok) throw new Error("DOWNLOAD_FAILED");
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement("a");
          link.href = url;
          link.download = "Lazuli - " + source.listing + ".xlsx";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
          return;
        }
        if (status === "failed" || Date.now() > deadline) throw new Error("EXPORT_FAILED");
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch {
      if (!current.signal.aborted) setFailed(true);
    } finally {
      controller.current = null;
      if (!current.signal.aborted) setBusy(false);
    }
  }
  const label = "Exportar " + source.listing.toLocaleLowerCase("pt-BR") + " para Excel";
  return (
    <>
      <Button
        aria-label={label}
        title={label}
        loading={busy}
        onClick={() => void download()}
        size="icon-sm"
        variant="secondary"
      >
        <FileOutput aria-hidden="true" />
      </Button>
      {failed && <span role="alert">Não foi possível exportar. Tente novamente.</span>}
    </>
  );
}
