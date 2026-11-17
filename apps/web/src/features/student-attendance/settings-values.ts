import type { RouterOutputs } from "@lazuli/api";
import { attendanceSettingsSchema } from "@lazuli/validators";

export type Settings = RouterOutputs["studentAttendance"]["settings"];
export type SchoolPoint = { latitude: number; longitude: number };
export type Values = {
  addressLabel: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
  maxAccuracyMeters: string;
};
export type SettingsErrors = Partial<Record<keyof Values, string>>;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

export function settingsValues(initial: Settings): Values {
  return {
    addressLabel: initial?.addressLabel ?? "",
    latitude: String(initial?.latitude ?? ""),
    longitude: String(initial?.longitude ?? ""),
    radiusMeters: String(initial?.radiusMeters ?? 200),
    maxAccuracyMeters: String(initial?.maxAccuracyMeters ?? ""),
  };
}

export function numericValue(value: string): number {
  const text = value.trim().replace(",", ".");
  return text && /^-?\d+(?:\.\d+)?$/u.test(text) ? Number(text) : Number.NaN;
}

export function settingsPoint(values: Values): SchoolPoint | null {
  const latitude = numericValue(values.latitude);
  const longitude = numericValue(values.longitude);
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > MAX_LATITUDE ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > MAX_LONGITUDE
  )
    return null;
  return { latitude, longitude };
}

export function validateLocation(
  values: Values,
):
  | { values: ReturnType<typeof attendanceSettingsSchema.parse>; errors: null }
  | { values: null; errors: SettingsErrors } {
  const result = attendanceSettingsSchema.safeParse({
    addressLabel: values.addressLabel.trim() || null,
    latitude: numericValue(values.latitude),
    longitude: numericValue(values.longitude),
    radiusMeters: numericValue(values.radiusMeters),
    maxAccuracyMeters: numericValue(values.maxAccuracyMeters),
  });
  if (result.success) return { values: result.data, errors: null };
  const messages: Record<keyof Values, string> = {
    addressLabel: "Use um endereço com até 500 caracteres.",
    latitude: "Escolha um endereço, marque o mapa ou informe uma latitude válida.",
    longitude: "Informe uma longitude entre -180 e 180.",
    radiusMeters: "Informe um raio inteiro entre 10 e 1.000 metros.",
    maxAccuracyMeters: "Informe uma precisão entre 5 e 500 metros.",
  };
  const errors: SettingsErrors = {};
  for (const issue of result.error.issues) {
    const name = issue.path[0] as keyof Values;
    errors[name] = messages[name];
  }
  return { values: null, errors };
}
