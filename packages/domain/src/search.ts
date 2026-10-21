/** Comparison key only: never replace the text a person is editing or stored names. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]/gu, "");
}
