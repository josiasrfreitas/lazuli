/** School-wide reference; exceeding it does not block enrollment. */
export const CLASS_REFERENCE_CAPACITY = 25;
const HIGH_OCCUPANCY_START = 20;

export function classOccupancyLevel(occupancy: number): "normal" | "high" | "over" {
  if (occupancy > CLASS_REFERENCE_CAPACITY) return "over";
  if (occupancy >= HIGH_OCCUPANCY_START) return "high";
  return "normal";
}
