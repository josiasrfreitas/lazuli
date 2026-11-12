"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button, ToastAlert } from "@lazuli/ui";
import styles from "./mobile-upload.module.css";
const QR_CELL_DELAY_MS = 20;
const QR_COVER_DURATION_MS = 350;
export function MobileUploadLink({ url }: { url: string }): ReactElement {
  const [mobileOrigin, setMobileOrigin] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/mobile-upload-origin")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { origin: string | null };
        if (active) setMobileOrigin(data.origin);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const destination = mobileOrigin ? url.replace(location.origin, mobileOrigin) : url;
  const qrHost = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => animateQr(qrHost.current), [destination]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className={styles.stack}>
      <div className={styles.qr} ref={qrHost}>
        <QRCodeSVG
          value={destination}
          size={192}
          marginSize={4}
          title="Enviar documentos pelo celular"
        />
      </div>
      <div className={`${styles.actions} ${styles.qrActions}`}>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label={copied ? "Link copiado" : "Copiar link"}
          title={copied ? "Link copiado" : "Copiar link"}
          onClick={() => {
            void navigator.clipboard
              .writeText(destination)
              .then(() => setCopied(true))
              .catch(() => setError("Não foi possível copiar. Use Abrir link."));
          }}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
        <Button
          size="icon-sm"
          variant="secondary"
          nativeButton={false}
          render={<a href={destination} target="_blank" rel="noreferrer" />}
          aria-label="Abrir link"
          title="Abrir link"
        >
          <ExternalLink aria-hidden="true" />
        </Button>
      </div>
      {error && <ToastAlert variant="warning">{error}</ToastAlert>}
    </div>
  );
}

// A temporary white cover reveals cells without changing the encoded QR paths.
function animateQr(host: HTMLDivElement | null): (() => void) | undefined {
  const svg = host?.querySelector("svg");
  if (!svg || globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const size = svg.viewBox.baseVal.width;
  if (!Number.isInteger(size) || size <= 0) return;
  const namespace = "http://www.w3.org/2000/svg";
  const cover = document.createElementNS(namespace, "g");
  cover.setAttribute("aria-hidden", "true");
  cover.setAttribute("fill", "white");
  cover.setAttribute("shape-rendering", "crispEdges");
  const groups = Array.from({ length: 16 }, () => "");
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const group = Math.floor(Math.random() * groups.length);
      groups[group] += `M${column} ${row}h1v1h-1z`;
    }
  }
  const animations = groups.map((path, index) => {
    const cells = document.createElementNS(namespace, "path");
    cells.setAttribute("d", path);
    cover.append(cells);
    return cells.animate([{ opacity: 1 }, { opacity: 0 }], {
      delay: index * QR_CELL_DELAY_MS,
      duration: 40,
      fill: "forwards",
      easing: "steps(1, end)",
    });
  });
  svg.append(cover);
  const timer = globalThis.setTimeout(() => cover.remove(), QR_COVER_DURATION_MS);
  return () => {
    globalThis.clearTimeout(timer);
    for (const animation of animations) animation.cancel();
    cover.remove();
  };
}
