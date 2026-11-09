"use client";
import type { JSX as ReactJSX } from "react";
import { ClassAgenda } from "~/features/class-records/agenda";

export function TeacherAgenda(): ReactJSX.Element {
  return <ClassAgenda teacherView />;
}
