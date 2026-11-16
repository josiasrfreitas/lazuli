/** Default capacity for newly created classes; existing classes keep their own capacity. */
export const CLASS_REFERENCE_CAPACITY = 25;
const HIGH_OCCUPANCY_RATIO = 0.8;

export function classOccupancyLevel(
  occupancy: number,
  capacity = CLASS_REFERENCE_CAPACITY,
): "normal" | "high" | "over" {
  if (occupancy > capacity) return "over";
  if (occupancy >= capacity * HIGH_OCCUPANCY_RATIO) return "high";
  return "normal";
}
