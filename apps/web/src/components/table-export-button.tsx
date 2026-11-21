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
    return field.selected
      .map((id) => options.find((option) => option.id === id)?.label ?? id)
      .join(", ");
  }
  const format = (value: string): string =>
    field.kind === "period" ? value.split("-").toReversed().join("/") : value;
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
      const id = await requestExport(client, { source, fields, search, criteria });
      await downloadExport(client, { id, listing: source.listing, signal: current.signal });
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

type ExportClient = ReturnType<typeof trpc.useUtils>["client"];
type ExportSelection = {
  source: RouterInputs["reports"]["requestTableExport"]["source"];
  fields: TableFilterField[];
  search: string;
  criteria: TableExportRequest["criteria"];
};
const EXPORT_WAIT_MS = 960_000;
const EXPORT_POLL_MS = 1500;
const EXPORT_URL_LIFETIME_MS = 30_000;

async function requestExport(
  client: ExportClient,
  { source, fields, search, criteria }: ExportSelection,
): Promise<string> {
  const selected: TableExportRequest["criteria"] = fields
    .map((field) => [field.label, description(field)] as [string, string])
    .filter(([, value]) => Boolean(value));
  if (search) selected.unshift(["Busca", search]);
  const result = await client.reports.requestTableExport.mutate({
    source,
    criteria: [...criteria, ...selected],
  });
  return result.id;
}

type PendingExport = { id: string; listing: string; signal: AbortSignal };
async function downloadExport(client: ExportClient, pending: PendingExport): Promise<void> {
  const { id, signal } = pending;
  const deadline = Date.now() + EXPORT_WAIT_MS;
  while (!signal.aborted) {
    const status = await client.reports.tableExportStatus.query({ id }, { signal });
    if (status === "ready") return saveExport(pending);
    if (status === "failed" || Date.now() > deadline) throw new Error("EXPORT_FAILED");
    await new Promise((resolve) => setTimeout(resolve, EXPORT_POLL_MS));
  }
}
async function saveExport({ id, listing, signal }: PendingExport): Promise<void> {
  const response = await fetch("/api/table-exports/" + id, { signal });
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "Lazuli - " + listing + ".xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), EXPORT_URL_LIFETIME_MS);
}
