"use client";
import { useState } from "react";
import { Alert, Badge, Button, Dialog, DialogBackdrop, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogPortal, DialogTitle, Input, SegmentedControl, SegmentedControlItem, Textarea } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { SelectControl } from "~/features/classes/form-controls";
import { TeacherPage, TeacherQueryState } from "./shared";
type Visit = RouterOutputs["teacherWorkspace"]["visit"];
const titles = { PLACEMENT: "Nivelamento", INTRODUCTION: "Aula experimental", TRIAL: "Experimental na turma" };

export function TeacherVisits() {
  const query = trpc.teacherWorkspace.visits.useQuery();
  const [selected, setSelected] = useState<string | null>(null);
  return <TeacherPage title="Experimentais e nivelamentos" description="Encontros e correções atribuídos a você." back="/professor">
    <TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {query.data && <div className="divide-y divide-border rounded-lg border border-border bg-card">{query.data.map((row) => <button key={row.id} type="button" className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-muted" onClick={() => setSelected(row.id)}><span className="text-sm font-semibold">{row.candidate.fullName}<span className="mt-1 block text-caption font-normal text-muted-foreground">{titles[row.kind]} · {formatDateOnlyBR(row.date)} · {row.startTime}</span></span><Badge variant={row.assessment && !row.assessment.stageId ? "warning" : "neutral"}>{row.assessment?.stageId ? "Corrigido" : row.assessment ? "Por corrigir" : row.status === "SCHEDULED" ? "Agendado" : row.status === "CANCELLED" ? "Cancelado" : "Registrado"}</Badge></button>)}{query.data.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nenhum encontro atribuído.</p>}</div>}
    {selected && <TeacherVisitDialog id={selected} onClose={() => setSelected(null)} />}
  </TeacherPage>;
}

export function TeacherVisitDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const query = trpc.teacherWorkspace.visit.useQuery({ id });
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogPortal><DialogBackdrop /><DialogContent className="md:max-w-2xl">
    <DialogHeader><DialogTitle>{query.data ? `${titles[query.data.kind]} · ${query.data.candidate.fullName}` : "Encontro"}</DialogTitle></DialogHeader>
    <DialogBody><TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />{query.data && <TeacherVisitBody key={query.data.id} visit={query.data} />}</DialogBody>
    <DialogFooter><Button variant="secondary" onClick={onClose}>Fechar</Button></DialogFooter>
  </DialogContent></DialogPortal></Dialog>;
}
function TeacherVisitBody({ visit }: { visit: Visit }) {
  const [outcome, setOutcome] = useState<"ATTENDED" | "ABSENT">(visit.status === "ABSENT" ? "ABSENT" : "ATTENDED");
  const [notes, setNotes] = useState(visit.notes ?? "");
  const utils = trpc.useUtils();
  const refresh = () => Promise.all([utils.teacherWorkspace.invalidate(), utils.classRecords.invalidate()]);
  const save = trpc.teacherWorkspace.visitOutcome.useMutation({ onSuccess: refresh });
  return <div className="grid gap-5 py-4">
    <p className="text-sm text-muted-foreground">{formatDateOnlyBR(visit.date)} · {visit.startTime}–{visit.endTime} · {visit.format === "ONLINE" ? "Online" : "Presencial"}</p>
    {visit.kind === "PLACEMENT" && <TeacherPlacement visit={visit} />}
    {visit.canRecord && (visit.kind !== "PLACEMENT" || !visit.assessment) ? <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ id: visit.id, status: outcome, notes }); }}>
      <SegmentedControl aria-label="Comparecimento" value={outcome} onValueChange={(value) => { if (value === "ATTENDED" || value === "ABSENT") setOutcome(value); }}><SegmentedControlItem value="ATTENDED">Compareceu</SegmentedControlItem><SegmentedControlItem value="ABSENT">Não compareceu</SegmentedControlItem></SegmentedControl>
      <label className="grid gap-2 text-sm">Registro do encontro<Textarea value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder="Como foi a participação e o que precisa ser retomado?" /></label>
      {save.error && <Alert variant="destructive">{save.error.message}</Alert>}{save.isSuccess && <p role="status" className="text-sm text-success">Comparecimento registrado.</p>}
      <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar comparecimento"}</Button>
    </form> : visit.notes && <p className="whitespace-pre-wrap text-sm">{visit.notes}</p>}
    {!visit.canRecord && <p className="text-caption text-muted-foreground">Registro indisponível: o encontro ainda não começou ou está encerrado para alterações.</p>}
  </div>;
}
function TeacherPlacement({ visit }: { visit: Visit }) {
  const utils = trpc.useUtils();
  const refresh = () => Promise.all([utils.teacherWorkspace.invalidate(), utils.classRecords.invalidate()]);
  const stages = trpc.teacherWorkspace.stages.useQuery();
  const result = trpc.teacherWorkspace.placementResult.useMutation({ onSuccess: refresh });
  const download = trpc.teacherWorkspace.placementDownload.useMutation();
  const upload = trpc.teacherWorkspace.placementUpload.useMutation({ onSuccess: refresh });
  const [stageId, setStageId] = useState(visit.assessment?.stageId ?? "");
  const [notes, setNotes] = useState(visit.assessment?.notes ?? "");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const canEdit = visit.canRecord && visit.status !== "ABSENT";
  async function addFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.size || file.size > 5 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) { setError("Escolha um PDF, JPG ou PNG de até 5 MB."); return; }
    setReading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]!); reader.onerror = () => reject(new Error("Não foi possível ler o arquivo.")); reader.readAsDataURL(file); });
      await upload.mutateAsync({ id: visit.id, fileName: file.name, contentType: file.type as "application/pdf" | "image/jpeg" | "image/png", base64 });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Envio interrompido. Selecione novamente o arquivo."); } finally { setReading(false); }
  }
  return <section className="grid gap-4 rounded-lg border border-border p-4">
    <h3 className="text-sm font-semibold">Prova de nivelamento</h3>
    {visit.assessment ? <>
      <Button variant="secondary" disabled={download.isPending} onClick={async () => {
        try { const file = await download.mutateAsync({ id: visit.id }); const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.fileName; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch { /* Mutation error is shown below. */ }
      }}>Baixar {visit.assessment.fileName}</Button>
      {visit.assessment.stage && <p className="text-sm">Estágio registrado: {visit.assessment.stage.name}</p>}
      {canEdit && <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (stageId) result.mutate({ id: visit.id, stageId, notes }); }}>
        <SelectControl name={`placement-stage-${visit.id}`} label="Estágio indicado" value={stageId} onChange={setStageId} choices={(stages.data ?? []).map((row) => ({ value: row.id, label: row.name }))} />
        <label className="grid gap-2 text-sm">Observações da correção<Textarea value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} /></label>
        <Button type="submit" disabled={!stageId || result.isPending}>{result.isPending ? "Salvando…" : "Registrar resultado"}</Button>{result.isSuccess && <p role="status" className="text-sm text-success">Resultado salvo.</p>}
      </form>}
    </> : canEdit && <label className="grid gap-2 text-sm">Anexar prova aplicada · até 5 MB<Input type="file" accept="application/pdf,image/jpeg,image/png" disabled={reading} onChange={(event) => void addFile(event.target.files?.[0])} />{reading && <span role="status">Enviando a prova. Mantenha este encontro aberto até concluir.</span>}</label>}
    {(error || result.error || download.error || stages.error) && <Alert variant="destructive">{error || result.error?.message || download.error?.message || stages.error?.message}</Alert>}
  </section>;
}
