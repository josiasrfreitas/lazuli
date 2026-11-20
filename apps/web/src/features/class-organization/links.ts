export const academicPeriodsUrl = "/aulas?visao=academico&configurar=semestres";

export function formationUrl(values: Record<string, string | string[] | undefined>): string {
  if (values.visao === "calendar") return academicPeriodsUrl;
  const params = new URLSearchParams();
  for (const key of ["semestre", "turma", "visao"]) {
    const value = values[key];
    if (typeof value === "string") params.set(key, value);
  }
  return "/turmas/formacao" + (params.size > 0 ? "?" + params.toString() : "");
}
