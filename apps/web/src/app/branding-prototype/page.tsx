import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { workshopEnabled } from "./config";
import { BrandWorkshop } from "./workshop";

export const metadata: Metadata = {
  title: "Workshop de marca — Lazuli",
  robots: { index: false, follow: false },
};

// Disposable workshop: three new directions on ?variant=D|E|F and reference B.
// A separate canvas lets the identity be evaluated beyond its sidebar application.
export default function BrandingPrototypePage(): ReactNode {
  if (!workshopEnabled) notFound();

  return (
    <Suspense fallback={<p className="p-8 text-muted-foreground">Abrindo o workshop…</p>}>
      <BrandWorkshop />
    </Suspense>
  );
}
