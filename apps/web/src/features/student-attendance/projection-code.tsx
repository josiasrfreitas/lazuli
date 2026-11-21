import type { ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";

export function ProjectionCode({ url, title }: { url: string; title: string }): ReactElement {
  return (
    <>
      <div className="mx-auto w-full max-w-xs">
        <QRCodeSVG value={url} size={320} marginSize={4} className="h-auto w-full" title={title} />
      </div>
      <p className="text-lg">Aponte a câmera, encontre seu nome e confirme.</p>
    </>
  );
}
