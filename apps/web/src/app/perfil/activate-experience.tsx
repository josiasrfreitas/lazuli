"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect } from "react";
import { GraduationCap, Shield } from "lucide-react";
import type { StaffRole } from "@lazuli/auth/roles";
import { activateExperience } from "~/lib/staff-experience";

export function ActivateExperience({
  role,
  destination,
}: {
  role: StaffRole;
  destination: string;
}): ReactJSX.Element {
  useEffect(() => {
    // Redirects may arrive without the original fragment, which is browser-only.
    activateExperience(role, `${destination}${destination.includes("#") ? "" : location.hash}`);
  }, [role, destination]);

  const Icon = role === "TEACHER" ? GraduationCap : Shield;
  return (
    <main
      className="flex min-h-svh items-center justify-center gap-3 bg-background text-muted-foreground"
      role="status"
    >
      <Icon className="size-5" aria-hidden="true" />
      <p>{role === "TEACHER" ? "Abrindo área do professor…" : "Abrindo administração…"}</p>
    </main>
  );
}
