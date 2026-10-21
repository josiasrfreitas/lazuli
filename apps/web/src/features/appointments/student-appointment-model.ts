"use client";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import type { Appointment } from "./shared";
export type StudentAppointmentProps = {
  id: string;
  admin: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
};
export type AppointmentAction = "cancel" | "reschedule" | null;
export type StudentAppointmentModel = {
  props: StudentAppointmentProps;
  query: ReturnType<typeof trpc.appointments.detail.useQuery<Appointment>>;
  editing: boolean;
  setEditing: (value: boolean) => void;
  pending: boolean;
  setPending: (value: boolean) => void;
  footerTarget: HTMLDivElement | null;
  setFooterTarget: (value: HTMLDivElement | null) => void;
  action: AppointmentAction;
  setAction: (value: AppointmentAction) => void;
  finish: () => void;
};
export function useStudentAppointment(props: StudentAppointmentProps): StudentAppointmentModel {
  const query = trpc.appointments.detail.useQuery({ id: props.id }, { retry: false });
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);
  const [action, setAction] = useState<AppointmentAction>(null);
  function finish(): void {
    setPending(false);
    setEditing(false);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`#${CSS.escape(`appointment-edit-${props.id}`)}`)
        ?.focus(),
    );
  }
  return {
    props,
    query,
    editing,
    setEditing,
    pending,
    setPending,
    footerTarget,
    setFooterTarget,
    action,
    setAction,
    finish,
  };
}
