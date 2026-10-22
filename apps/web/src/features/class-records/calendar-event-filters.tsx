import type { JSX as ReactJSX } from "react";
import { MapPin, Video } from "lucide-react";
import styles from "./calendar.module.css";

export const EVENT_TYPES = [
  { id: "REGULAR", label: "Regular" },
  { id: "PERSONALIZED", label: "PPT" },
  { id: "EXPERIMENTAL", label: "Experimental" },
  { id: "APPOINTMENT", label: "Atendimento" },
];

type FilterProps = { values: string[]; onChange: (values: string[]) => void };
function toggleFilter(value: string, values: string[]): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function CalendarEventFilters({
  types,
  formats,
  onTypesChange,
  onFormatsChange,
}: {
  types: string[];
  formats: string[];
  onTypesChange: (values: string[]) => void;
  onFormatsChange: (values: string[]) => void;
}): ReactJSX.Element {
  return (
    <>
      <FormatFilters values={formats} onChange={onFormatsChange} />
      <TypeFilters values={types} onChange={onTypesChange} />
    </>
  );
}

function FormatFilters({ values, onChange }: FilterProps): ReactJSX.Element {
  return (
    <div className={styles.legend} role="group" aria-label="Filtrar por formato">
      {[
        { label: "Presencial", Icon: MapPin },
        { label: "Online", Icon: Video },
      ].map(({ label, Icon }) => (
        <button
          key={label}
          type="button"
          className="inline-flex items-center gap-1 text-muted-foreground"
          data-format={label}
          aria-label={`Filtrar por ${label}`}
          aria-pressed={values.includes(label)}
          onClick={() => onChange(toggleFilter(label, values))}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function TypeFilters({ values, onChange }: FilterProps): ReactJSX.Element {
  return (
    <div className={styles.legend} role="group" aria-label="Filtrar por tipo de evento">
      {EVENT_TYPES.map((type) => (
        <button
          key={type.id}
          type="button"
          data-modality={type.id}
          aria-pressed={values.includes(type.id)}
          aria-label={`Filtrar por ${type.label}`}
          onClick={() => onChange(toggleFilter(type.id, values))}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}
