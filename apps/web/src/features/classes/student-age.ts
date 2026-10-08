/** Birth dates are civil dates; today is supplied by the API in São Paulo. */
export function studentAgeLabel(birthDate: Date | null, today: string): string {
  if (!birthDate) return "Idade não informada";
  const current = new Date(`${today}T00:00:00Z`);
  const birthdayPending =
    current.getUTCMonth() < birthDate.getUTCMonth() ||
    (current.getUTCMonth() === birthDate.getUTCMonth() &&
      current.getUTCDate() < birthDate.getUTCDate());
  const age = current.getUTCFullYear() - birthDate.getUTCFullYear() - Number(birthdayPending);
  return `${age} ${age === 1 ? "ano" : "anos"}`;
}
