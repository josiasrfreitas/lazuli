import { MapPin, Video } from "lucide-react";
import styles from "./calendar.module.css";

export const EVENT_TYPES = [
  { id: "REGULAR", label: "Regular" },
  { id: "PERSONALIZED", label: "PPT" },
  { id: "EXPERIMENTAL", label: "Experimental" },
  { id: "APPOINTMENT", label: "Atendimento" },
];

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
}) {
  return (
    <>
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
            aria-pressed={formats.includes(label)}
            onClick={() =>
              onFormatsChange(
                formats.includes(label)
                  ? formats.filter((value) => value !== label)
                  : [...formats, label],
              )
            }
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div className={styles.legend} role="group" aria-label="Filtrar por tipo de evento">
        {EVENT_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            data-modality={type.id}
            aria-pressed={types.includes(type.id)}
            aria-label={`Filtrar por ${type.label}`}
            onClick={() =>
              onTypesChange(
                types.includes(type.id)
                  ? types.filter((id) => id !== type.id)
                  : [...types, type.id],
              )
            }
          >
            {type.label}
          </button>
        ))}
      </div>
    </>
  );
}
