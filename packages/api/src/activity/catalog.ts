export const ACTIVITY_ACTIONS = {
  "appointments.schedule": ["PEDAGOGICAL", "Atendimento agendado"],
  "appointments.record": ["PEDAGOGICAL", "Atendimento registrado"],
  "appointments.correct": ["PEDAGOGICAL", "Atendimento corrigido"],
  "appointments.cancel": ["PEDAGOGICAL", "Atendimento cancelado"],
  "appointments.reschedule": ["PEDAGOGICAL", "Atendimento reagendado"],
  "appointments.contact": ["PEDAGOGICAL", "Contato sobre frequência registrado"],
  "assessments.save": ["PEDAGOGICAL", "Notas registradas ou corrigidas"],
  "assessments.confirm": ["PEDAGOGICAL", "Resultado pedagógico confirmado"],
  "studentAttendance.open": ["PEDAGOGICAL", "Abriu link de presença"],
  "studentAttendance.close": ["PEDAGOGICAL", "Encerrou link de presença"],
  "planning.create": ["PEDAGOGICAL", "Planejamento criado"],
  "planning.revise": ["PEDAGOGICAL", "Planejamento revisado"],
  "classRecords.confirm": ["PEDAGOGICAL", "Aula registrada"],
  "classRecords.correct": ["PEDAGOGICAL", "Registro da aula corrigido"],
} as const;
export type ActivityAction = keyof typeof ACTIVITY_ACTIONS;
