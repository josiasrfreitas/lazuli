"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function AttendanceProjectionPreview(): ReactJSX.Element {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${window.location.origin}/presenca/previa${window.location.search}`);
  }, []);
  return (
    <main className="grid min-h-dvh place-content-center gap-6 bg-background p-6 text-center">
      <h1 className="font-display text-h2 font-semibold">Confirme sua presença</h1>
      {url && (
        <div className="mx-auto w-full max-w-xs">
          <QRCodeSVG
            value={url}
            size={320}
            marginSize={4}
            className="h-auto w-full"
            title="QR Code de demonstração da presença"
          />
        </div>
      )}
      <p>Aponte a câmera, encontre seu nome e confirme.</p>
      <p className="text-caption text-muted-foreground">
        Prévia com dados fictícios. Nenhuma presença real será registrada.
      </p>
    </main>
  );
}
