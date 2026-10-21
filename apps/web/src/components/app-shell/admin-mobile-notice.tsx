"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@lazuli/ui";

export function AdminMobileNotice({
  userId,
  isMobileDevice,
}: {
  userId: string;
  isMobileDevice: boolean;
}): ReactJSX.Element {
  const storageKey = `lazuli.admin-mobile-notice.v1:${userId}`;
  const [acknowledged, setAcknowledged] = useState(true);
  const [mobile, setMobile] = useState(isMobileDevice);

  useEffect(() => {
    try {
      setAcknowledged(localStorage.getItem(storageKey) === "1");
    } catch {
      setAcknowledged(false);
    }

    const viewport = globalThis.matchMedia("(max-width: 767px)");
    const updateMobile = (): void => setMobile(isMobileDevice || viewport.matches);
    updateMobile();
    viewport.addEventListener("change", updateMobile);
    return () => viewport.removeEventListener("change", updateMobile);
  }, [isMobileDevice, storageKey]);

  function acknowledge(): void {
    setAcknowledged(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Closing the notice still works when browser storage is unavailable.
    }
  }

  return (
    <Dialog
      open={mobile && !acknowledged}
      onOpenChange={(open) => {
        if (!open) acknowledge();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="top-[50dvh] max-w-[calc(100dvw-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle>Administração no celular</DialogTitle>
          </DialogHeader>
          <DialogBody className="mt-3">
            <DialogDescription>
              O suporte à Administração no celular ainda não é garantido. Algumas telas e funções
              podem não funcionar como esperado. Para uma experiência completa, use um computador.
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button size="lg" className="w-full" />}>
              Entendi, continuar
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
