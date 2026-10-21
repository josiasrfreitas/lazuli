"use client";
import { useEffect, useState, type ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Alert } from "@lazuli/ui";
import { attendanceTokenSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { attendanceTime } from "./location";
const PROJECTION_POLL_MS = 3000;
const QR_SIZE = 320;
const QUIET_ZONE = 4;
export function AttendanceProjectionPage(): ReactElement {
  const [token, setToken] = useState("");
  useEffect(() => {
    const read = (): void => setToken(globalThis.location.hash.slice(1));
    read();
    globalThis.addEventListener("hashchange", read);
    return () => globalThis.removeEventListener("hashchange", read);
  }, []);
  return (
    <main className="grid min-h-dvh place-content-center gap-7 bg-background p-6 text-center">
      <p className="font-display text-xl tracking-widest">LAZULI</p>
      <h1 className="font-display text-h1 font-semibold">Confirme sua presença</h1>
      {attendanceTokenSchema.safeParse({ token }).success ? (
        <ProjectionContent key={token} token={token} />
      ) : (
        <Alert>Abra o acesso de projeção compartilhado pelo professor.</Alert>
      )}
      <p className="text-caption text-muted-foreground">
        O professor revisará a chamada. Se precisar de ajuda, fale com ele.
      </p>
    </main>
  );
}
function ProjectionContent({ token }: { token: string }): ReactElement {
  const query = trpc.studentAttendance.projection.useMutation();
  const read = query.mutate;
  useEffect(() => {
    const poll = (): void => read({ token });
    poll();
    const timer = globalThis.setInterval(poll, PROJECTION_POLL_MS);
    return () => globalThis.clearInterval(timer);
  }, [read, token]);
  if (query.error) return <Alert>{query.error.message}</Alert>;
  if (!query.data?.token || !query.data.expiresAt)
    return (
      <p role="status" className="text-lg">
        Aguardando o professor abrir um novo QR…
      </p>
    );
  const link = `${globalThis.location.origin}/presenca#${query.data.token}`;
  return (
    <>
      <div className="mx-auto w-fit">
        <QRCodeSVG
          value={link}
          size={QR_SIZE}
          marginSize={QUIET_ZONE}
          title="Leia com o celular para confirmar sua presença"
        />
      </div>
      <p className="text-lg">Aponte a câmera, encontre seu nome e confirme.</p>
      <p className="text-muted-foreground">
        Válido até {attendanceTime(query.data.expiresAt)} · Confirme somente seu próprio nome.
      </p>
    </>
  );
}
