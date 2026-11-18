import { QrCode } from "lucide-react";
import { toastManager } from "@lazuli/ui";

const SESSION_KEY = "lazuli:mobile-upload-hint-seen";
let shown = false;

/** One hint per browser tab session, including modal remounts and reloads. */
export function showMobileUploadHint(): (() => void) | undefined {
  if (shown) return;
  shown = true;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Keep the in-memory guard when browser storage is unavailable.
  }
  const id = toastManager.add({
    type: "onboarding",
    title: "Envie também pelo celular",
    description: (
      <>
        No painel de anexos, clique no ícone de QR code{" "}
        <QrCode aria-hidden="true" className="inline-block size-4 align-text-bottom" />. Escaneie o
        código com o celular para enviar fotos pela câmera.
      </>
    ),
    timeout: 6500,
  });
  return () => toastManager.close(id);
}
