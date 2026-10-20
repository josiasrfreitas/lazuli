type PartyRow = { party: { key: string; name: string } };

/** Shared by editing and review so each installment appears in exactly one group. */
export function treatmentGroups<T extends PartyRow>(
  rows: T[],
): { key: string; name: string; rows: T[] }[] {
  const groups = new Map<string, { key: string; name: string; rows: T[] }>();
  for (const row of rows) {
    const group = groups.get(row.party.key);
    if (group) group.rows.push(row);
    else groups.set(row.party.key, { ...row.party, rows: [row] });
  }
  return [...groups.values()].toSorted((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
}
