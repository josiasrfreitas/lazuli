"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useState } from "react";
import { ProjectionCode } from "./projection-code";

export function AttendanceProjectionPreview(): ReactJSX.Element {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${globalThis.location.origin}/presenca/previa${globalThis.location.search}`);
  }, []);
  return (
    <main className="grid min-h-dvh place-content-center gap-6 bg-background p-6 text-center">
      <h1 className="font-display text-h2 font-semibold">Confirme sua presença</h1>
      {url && <ProjectionCode url={url} title="QR Code de demonstração da presença" />}
      <p className="text-caption text-muted-foreground">
        Prévia com dados fictícios. Nenhuma presença real será registrada.
      </p>
    </main>
  );
}
