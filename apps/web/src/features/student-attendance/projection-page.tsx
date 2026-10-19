"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Alert } from "@lazuli/ui";
import { attendanceTokenSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { attendanceTime } from "./location";

export function AttendanceProjectionPage() {
  const query = trpc.studentAttendance.projection.useMutation();
  const read = query.mutate;
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const poll = () => {
      const token = window.location.hash.slice(1);
      if (!attendanceTokenSchema.safeParse({ token }).success) { setInvalid(true); return; }
      setInvalid(false);
      read({ token });
    };
    poll();
    const timer = setInterval(poll, 3_000);
    window.addEventListener("hashchange", poll);
    return () => { clearInterval(timer); window.removeEventListener("hashchange", poll); };
  }, [read]);
  const link = query.data?.token && !query.error ? `${window.location.origin}/presenca#${query.data.token}` : null;
  return <main className="grid min-h-dvh place-content-center gap-7 bg-background p-6 text-center">
    <p className="font-display text-xl tracking-widest">LAZULI</p>
    <h1 className="font-display text-h1 font-semibold">Confirme sua presença</h1>
    {invalid ? <Alert>Abra o acesso de projeção compartilhado pelo professor.</Alert> : query.error ? <Alert>{query.error.message}</Alert> : link ? <>
      <div className="mx-auto w-fit rounded-xl bg-white p-4"><QRCodeSVG value={link} size={320} marginSize={4} title="Leia com o celular para confirmar sua presença" /></div>
      <p className="text-lg">Aponte a câmera, encontre seu nome e confirme.</p>
      <p className="text-muted-foreground">Válido até {attendanceTime(query.data!.expiresAt!)} · Confirme somente seu próprio nome.</p>
    </> : <p role="status" className="text-lg">Aguardando o professor abrir um novo QR…</p>}
    <p className="text-caption text-muted-foreground">O professor revisará a chamada. Se precisar de ajuda, fale com ele.</p>
  </main>;
}
