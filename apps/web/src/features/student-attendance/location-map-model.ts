import type { SchoolPoint } from "./settings-values";

const EARTH_RADIUS_METERS = 6_371_000;
const CIRCLE_SEGMENTS = 64;
const DEGREES_PER_HALF_TURN = 180;
const radians = (degrees: number): number => (degrees * Math.PI) / DEGREES_PER_HALF_TURN;
const degrees = (value: number): number => (value * DEGREES_PER_HALF_TURN) / Math.PI;

/** Geographic circle in meters, rather than a screen-space radius. */
export function schoolArea(point: SchoolPoint, radiusMeters: number) {
  const latitude = radians(point.latitude);
  const longitude = radians(point.longitude);
  const distance = radiusMeters / EARTH_RADIUS_METERS;
  const coordinates = Array.from({ length: CIRCLE_SEGMENTS }, (_unused, index) => {
    const bearing = (index * 2 * Math.PI) / CIRCLE_SEGMENTS;
    const targetLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(distance) +
        Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing),
    );
    const targetLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude),
        Math.cos(distance) - Math.sin(latitude) * Math.sin(targetLatitude),
      );
    return [degrees(targetLongitude), degrees(targetLatitude)];
  });
  coordinates.push(coordinates[0]!);
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coordinates] },
  };
}
