export type FollowUpSelection = { kind: "intervention" | "occurrence"; id: string };
export type SelectFollowUp = (selection: FollowUpSelection) => void;
const RECORD_PATTERN =
  /^(intervention|occurrence):([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i;
export function parseFollowUpSelection(value: string): FollowUpSelection | null {
  const match = RECORD_PATTERN.exec(value);
  if (!match || (match[1] !== "intervention" && match[1] !== "occurrence") || !match[2])
    return null;
  return { kind: match[1], id: match[2] };
}
export function studentFollowUpHref(studentId: string, selection?: FollowUpSelection): string {
  const query = new URLSearchParams({ secao: "pedagogico" });
  if (selection) query.set("registro", `${selection.kind}:${selection.id}`);
  return `/alunos/${encodeURIComponent(studentId)}?${query.toString()}#acompanhamento`;
}
