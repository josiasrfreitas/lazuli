/** Heavy reads follow the visible workspace; identity and agenda eligibility come from byId. */
export function needsStudentPedagogy(section: string): boolean {
  return section === "visao-geral" || section === "pedagogico" || section === "planejamento";
}

export function needsStudentFinanceSummary(
  section: string,
  pedagogy: { ready: boolean; hasPersonalizedEnrollment: boolean },
): boolean {
  return (
    section === "financeiro" ||
    section === "pedagogico" ||
    (section === "planejamento" && pedagogy.ready && !pedagogy.hasPersonalizedEnrollment)
  );
}
