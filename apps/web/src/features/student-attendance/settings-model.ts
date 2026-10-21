"use client";
import { useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { attendanceSettingsSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { currentAttendanceLocation } from "./location";
export type Settings = RouterOutputs["studentAttendance"]["settings"];
export type Values = {
  latitude: string;
  longitude: string;
  radiusMeters: string;
  maxAccuracyMeters: string;
};
export function useSettingsForm(initial: Settings): SettingsModel {
  const [fields, setFields] = useState<Values>({
    latitude: String(initial?.latitude ?? ""),
    longitude: String(initial?.longitude ?? ""),
    radiusMeters: String(initial?.radiusMeters ?? ""),
    maxAccuracyMeters: String(initial?.maxAccuracyMeters ?? ""),
  });
  const [error, setError] = useState("");
  const save = trpc.studentAttendance.saveSettings.useMutation();
  const location = useSchoolLocation((value) => setFields((old) => ({ ...old, ...value })));
  function submit(): void {
    setError("");
    const parsed = attendanceSettingsSchema.safeParse({
      latitude: Number(fields.latitude),
      longitude: Number(fields.longitude),
      radiusMeters: Number(fields.radiusMeters),
      maxAccuracyMeters: Number(fields.maxAccuracyMeters),
    });
    if (Object.values(fields).some((value) => !value.trim()) || !parsed.success) {
      setError(
        parsed.success
          ? "Preencha as coordenadas, o raio e a precisão máxima."
          : parsed.error.issues[0]!.message,
      );
      return;
    }
    save.mutate(parsed.data);
  }
  return {
    fields,
    save,
    location,
    error,
    submit,
    change: (name, value) => {
      save.reset();
      setError("");
      setFields((old) => ({ ...old, [name]: value }));
    },
  };
}
function useSchoolLocation(
  change: (value: Pick<Values, "latitude" | "longitude">) => void,
): LocationModel {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function locate(): Promise<void> {
    setPending(true);
    setError("");
    try {
      const location = await currentAttendanceLocation();
      change({ latitude: String(location.latitude), longitude: String(location.longitude) });
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Localização indisponível.");
    } finally {
      setPending(false);
    }
  }
  return { pending, error, locate };
}
type LocationModel = { pending: boolean; error: string; locate: () => Promise<void> };
export type SettingsModel = {
  fields: Values;
  save: { isPending: boolean; isSuccess: boolean; error: { message: string } | null };
  location: LocationModel;
  error: string;
  submit: () => void;
  change: (name: keyof Values, value: string) => void;
};
