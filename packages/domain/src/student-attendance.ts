export type AttendanceNameCandidate = { id: string; name: string; phone: string | null };
const MAX_MATCHES = 8;
const MIN_NAME_LENGTH = 3;
const HALF_TURN = 180;
export type AttendanceMatches = {
  options: { id: string; name: string; phoneHint: string | null; manualRequired: boolean }[];
  exactId: string | null;
  refine: boolean;
};
const PHONE_SUFFIX_LENGTH = 4;
const EARTH_RADIUS_METRES = 6_371_000;
export function normalizeAttendanceName(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
/** No fuzzy identity inference: partial names require selection, indistinguishable homonyms use staff recording. */
export function matchAttendanceNames(
  candidates: AttendanceNameCandidate[],
  query: string,
): AttendanceMatches {
  const normalized = normalizeAttendanceName(query);
  const words = normalized.split(" ");
  const found =
    normalized.length < MIN_NAME_LENGTH
      ? []
      : candidates.filter((row) => {
          const parts = normalizeAttendanceName(row.name).split(" ");
          return words.every((word) => parts.some((part) => part.startsWith(word)));
        });
  if (found.length > MAX_MATCHES) return { options: [], exactId: null, refine: true };
  const options = found.map((row) => {
    const homonyms = found.filter(
      (other) => normalizeAttendanceName(other.name) === normalizeAttendanceName(row.name),
    );
    const hint = phoneSuffix(row.phone);
    const blocked =
      homonyms.length > 1 &&
      (!hint || homonyms.some((other) => other.id !== row.id && phoneSuffix(other.phone) === hint));
    return {
      id: row.id,
      name: row.name,
      phoneHint: homonyms.length > 1 ? hint : null,
      manualRequired: blocked,
    };
  });
  const exact = options.filter((row) => normalizeAttendanceName(row.name) === normalized);
  return {
    options,
    exactId: exact.length === 1 && !exact[0]!.manualRequired ? exact[0]!.id : null,
    refine: false,
  };
}
function phoneSuffix(phone: string | null): string | null {
  const digits = phone?.replaceAll(/\D/gu, "") ?? "";
  return digits.length >= PHONE_SUFFIX_LENGTH ? digits.slice(-PHONE_SUFFIX_LENGTH) : null;
}
export type AttendancePoint = { latitude: number; longitude: number };
/** Approximate distance for teacher review; it does not decide attendance or a campus radius. */
export function attendanceDistance(origin: AttendancePoint, target: AttendancePoint): number {
  const radians = (value: number): number => (value * Math.PI) / HALF_TURN;
  const latitude = radians(target.latitude - origin.latitude);
  const longitude = radians(target.longitude - origin.longitude);
  const haversine =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(origin.latitude)) *
      Math.cos(radians(target.latitude)) *
      Math.sin(longitude / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(Math.min(1, haversine))));
}
