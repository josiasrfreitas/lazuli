import type { JSX as ReactJSX } from "react";
import { MapPin, Video } from "lucide-react";
import tone from "./event-tone.module.css";
import styles from "./calendar.module.css";

import { EVENT_LABELS } from "./lesson-presentation";

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
      {Object.entries(EVENT_LABELS).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={tone.tone}
          data-modality={id}
          aria-pressed={values.includes(id)}
          aria-label={`Filtrar por ${label}`}
          onClick={() => onChange(toggleFilter(id, values))}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
