export const ACTIVITY_ACTIONS = {
  "planning.create": ["PEDAGOGICAL", "Planejamento criado"],
  "planning.revise": ["PEDAGOGICAL", "Planejamento revisado"],
  "classRecords.confirm": ["PEDAGOGICAL", "Aula registrada"],
  "classRecords.correct": ["PEDAGOGICAL", "Registro da aula corrigido"],
} as const;
export type ActivityAction = keyof typeof ACTIVITY_ACTIONS;
