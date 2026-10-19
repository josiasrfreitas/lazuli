"use client";
import { useState } from "react";
import { Alert, Button, Input } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { currentAttendanceLocation } from "./location";
import { TeacherPage, TeacherQueryState } from "~/features/teacher-workspace/shared";

export function AttendanceSettingsPage() {
  const query = trpc.studentAttendance.settings.useQuery();
  return <TeacherPage title="Localização para presença" description="Defina a área da escola usada pelo QR presencial.">
    <TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {query.data !== undefined && <SettingsForm initial={query.data} />}
  </TeacherPage>;
}
function SettingsForm({ initial }: { initial: { latitude: number; longitude: number; radiusMeters: number; maxAccuracyMeters: number } | null }) {
  const [latitude, setLatitude] = useState(String(initial?.latitude ?? ""));
  const [longitude, setLongitude] = useState(String(initial?.longitude ?? ""));
  const [radius, setRadius] = useState(String(initial?.radiusMeters ?? 100));
  const [accuracy, setAccuracy] = useState(String(initial?.maxAccuracyMeters ?? 50));
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const save = trpc.studentAttendance.saveSettings.useMutation();
  return <form className="grid max-w-lg gap-5" onSubmit={(event) => {
    event.preventDefault(); setError("");
    if (!latitude.trim() || !longitude.trim()) { setError("Informe as coordenadas da escola."); return; }
    save.mutate({ latitude: Number(latitude), longitude: Number(longitude), radiusMeters: Number(radius), maxAccuracyMeters: Number(accuracy) });
  }}>
    <p className="text-sm text-muted-foreground">Faça a configuração estando na escola ou informe suas coordenadas. Alunos fora do raio ou com localização imprecisa serão orientados à chamada manual.</p>
    <Button type="button" variant="secondary" disabled={locating} onClick={async () => { setLocating(true); setError(""); try { const location = await currentAttendanceLocation(); setLatitude(String(location.latitude)); setLongitude(String(location.longitude)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Localização indisponível."); } finally { setLocating(false); } }}>{locating ? "Localizando…" : "Usar minha localização na escola"}</Button>
    <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm">Latitude<Input type="number" step="any" min={-90} max={90} required value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label><label className="grid gap-1 text-sm">Longitude<Input type="number" step="any" min={-180} max={180} required value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label></div>
    <label className="grid gap-1 text-sm">Raio aceito (metros)<Input type="number" min={10} max={1000} required value={radius} onChange={(event) => setRadius(event.target.value)} /></label>
    <label className="grid gap-1 text-sm">Precisão máxima (metros)<Input type="number" min={5} max={500} required value={accuracy} onChange={(event) => setAccuracy(event.target.value)} /></label>
    <p className="text-caption text-muted-foreground">Sugestão inicial: raio de 100 m e precisão de até 50 m. Ajuste às condições reais da escola.</p>
    {(error || save.error) && <Alert variant="destructive">{error || save.error?.message}</Alert>}
    {save.isSuccess && <p role="status" className="text-sm text-success">Localização da escola salva.</p>}
    <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar localização da escola"}</Button>
  </form>;
}
