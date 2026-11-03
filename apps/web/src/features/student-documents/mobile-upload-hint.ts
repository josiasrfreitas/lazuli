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
    description:
      "Escaneie o QR code para enviar fotos pela câmera do celular. Abra o código pelo ícone no painel de anexos.",
    timeout: 6500,
  });
  return () => toastManager.close(id);
}
