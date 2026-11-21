"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactNode,
  type ReactElement,
} from "react";

export const TeacherViewContext = createContext<string | null>(null);

export function TeacherViewProvider({
  value,
  children,
}: {
  value: string | null;
  children: ReactNode;
}): ReactElement {
  return <TeacherViewContext.Provider value={value}>{children}</TeacherViewContext.Provider>;
}

export function teacherViewHref(href: string, teacherId: string | null): string {
  if (!teacherId || !href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://lazuli.invalid");
  url.searchParams.set("docente", teacherId);
  return url.pathname + url.search + url.hash;
}

export function ExperienceLink(props: ComponentProps<typeof Link>): ReactElement {
  const teacher = useContext(TeacherViewContext);
  return (
    <Link
      {...props}
      href={typeof props.href === "string" ? teacherViewHref(props.href, teacher) : props.href}
    />
  );
}
