"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { trpc } from "~/lib/trpc";
import { currentAttendanceLocation } from "./location";
import {
  settingsValues,
  settingsPoint,
  validateLocation,
  type Settings,
  type SettingsErrors,
  type Values,
  type SchoolPoint,
} from "./settings-values";
export type { Settings, Values } from "./settings-values";

export function useSettingsForm(initial: Settings): SettingsModel {
  const [fields, setFields] = useState<Values>(() => settingsValues(initial));
  const [baseline, setBaseline] = useState<Values>(() => settingsValues(initial));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const { formRef, flagInvalidField } = useSettingsFocus();
  const { locating, locationError, setLocationError, locate } = useGeolocation(setPoint);
  const [mapFocusVersion, setMapFocusVersion] = useState(0);
  const utils = trpc.useUtils();
  const save = trpc.studentAttendance.saveSettings.useMutation({
    onSuccess: (value) => {
      utils.studentAttendance.settings.setData(undefined, value);
      setFields(settingsValues(value));
      setBaseline(settingsValues(value));
    },
  });
  function change(name: keyof Values, value: string): void {
    save.reset();
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFields((current) => ({ ...current, [name]: value }));
  }
  function setPoint(point: SchoolPoint, label?: string): void {
    if (save.isPending) return;
    save.reset();
    setLocationError("");
    setErrors(({ latitude: _latitude, longitude: _longitude, ...rest }) => rest);
    setFields((current) => valuesAtPoint(current, { point, label }));
    if (label !== undefined) setMapFocusVersion((current) => current + 1);
  }
  function clearPoint(): void {
    if (save.isPending) return;
    save.reset();
    setLocationError("");
    setFields((current) => ({ ...current, addressLabel: "", latitude: "", longitude: "" }));
    setMapFocusVersion((current) => current + 1);
  }
  function submit(): void {
    if (save.isPending || locating) return;
    const result = validateLocation(fields);
    if (result.errors) {
      setErrors(result.errors);
      flagInvalidField();
      return;
    }
    setErrors({});
    save.mutate(result.values);
  }
  function reset(): void {
    setFields(baseline);
    setErrors({});
    setLocationError("");
    save.reset();
    setMapFocusVersion((current) => current + 1);
  }
  return {
    fields,
    formRef,
    errors,
    save,
    locating,
    locationError,
    submit,
    change,
    setPoint,
    clearPoint,
    mapFocusVersion,
    locate,
    reset,
    point: settingsPoint(fields),
    dirty: JSON.stringify(fields) !== JSON.stringify(baseline),
  };
}
function valuesAtPoint(
  current: Values,
  {
    point,
    label,
  }: {
    point: SchoolPoint;
    label: string | undefined;
  },
): Values {
  return {
    ...current,
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    addressLabel: label ?? current.addressLabel,
  };
}

function useSettingsFocus(): {
  formRef: RefObject<HTMLFormElement | null>;
  flagInvalidField: () => void;
} {
  const formRef = useRef<HTMLFormElement>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);
  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>('input[name="schoolAddress"]')?.focus();
  }, []);
  useEffect(() => {
    if (!validationAttempt) return;
    const frame = requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [validationAttempt]);
  return { formRef, flagInvalidField: () => setValidationAttempt((current) => current + 1) };
}

function useGeolocation(onLocated: SettingsModel["setPoint"]): {
  locating: boolean;
  locationError: string;
  setLocationError: (value: string) => void;
  locate: () => Promise<void>;
} {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  async function locate(): Promise<void> {
    setLocating(true);
    setLocationError("");
    try {
      onLocated(await currentAttendanceLocation(), "");
    } catch {
      setLocationError(
        "Não foi possível obter sua localização. Permita o acesso no navegador ou busque o endereço da escola.",
      );
    } finally {
      setLocating(false);
    }
  }
  return { locating, locationError, setLocationError, locate };
}
export type SettingsModel = {
  fields: Values;
  formRef: RefObject<HTMLFormElement | null>;
  errors: SettingsErrors;
  save: { isPending: boolean; isSuccess: boolean; error: { message: string } | null };
  locating: boolean;
  locationError: string;
  point: SchoolPoint | null;
  dirty: boolean;
  submit: () => void;
  change: (name: keyof Values, value: string) => void;
  setPoint: (point: SchoolPoint, label?: string) => void;
  clearPoint: () => void;
  mapFocusVersion: number;
  locate: () => Promise<void>;
  reset: () => void;
};
