import type { AppointmentSnapshot } from "@lazuli/validators";

export type AppointmentChange = { label: string; before: string; after: string };
const statuses = {
  SCHEDULED: "Agendado",
  ATTENDED: "Realizado",
  NO_SHOW: "Não compareceu",
  CANCELLED: "Cancelado",
};
const purposes = {
  MAKEUP: "Reposição de falta",
  PPT_COMPLEMENT: "Complemento PPT",
  REINFORCEMENT: "Reforço",
  ASSESSMENT: "Avaliação",
};
const fields: { label: string; value: (row: AppointmentSnapshot) => string | null }[] = [
  { label: "Situação", value: (row) => statuses[row.status] },
  { label: "Finalidade", value: (row) => purposes[row.purpose] },
  { label: "Formato", value: (row) => (row.format === "IN_PERSON" ? "Presencial" : "Online") },
];

/** Show value transitions only for enumerated fields; other edits are represented by the event. */
export function appointmentChanges(
  previous: AppointmentSnapshot,
  current: AppointmentSnapshot,
): AppointmentChange[] {
  const changes = fields.flatMap(({ label, value }) => {
    const before = value(previous) || "Não informado";
    const after = value(current) || "Não informado";
    return before === after ? [] : [{ label, before, after }];
  });
  return changes;
}
