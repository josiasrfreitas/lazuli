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
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [mapFocusVersion, setMapFocusVersion] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const utils = trpc.useUtils();
  const save = trpc.studentAttendance.saveSettings.useMutation({
    onSuccess: (value) => {
      utils.studentAttendance.settings.setData(undefined, value);
      setFields(settingsValues(value));
      setBaseline(settingsValues(value));
    },
  });
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
    setFields((current) => ({
      ...current,
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      addressLabel: label ?? current.addressLabel,
    }));
    if (label !== undefined) setMapFocusVersion((current) => current + 1);
  }
  function clearPoint(): void {
    if (save.isPending) return;
    save.reset();
    setLocationError("");
    setFields((current) => ({ ...current, addressLabel: "", latitude: "", longitude: "" }));
    setMapFocusVersion((current) => current + 1);
  }
  async function locate(): Promise<void> {
    setLocating(true);
    setLocationError("");
    try {
      setPoint(await currentAttendanceLocation(), "");
    } catch {
      setLocationError(
        "Não foi possível obter sua localização. Permita o acesso no navegador ou busque o endereço da escola.",
      );
    } finally {
      setLocating(false);
    }
  }
  function submit(): void {
    if (save.isPending || locating) return;
    const result = validateLocation(fields);
    if (result.errors) {
      setErrors(result.errors);
      setValidationAttempt((current) => current + 1);
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
