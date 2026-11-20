export function includeNextSeedSemester(): boolean {
  return process.env.LAZULI_SEED_SKIP_NEXT_SEMESTER !== "1";
}
