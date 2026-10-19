import { useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import styles from "./layout-workshop.module.css";

export type AppointmentScenario = "empty" | "one" | "few" | "several";
export type PreviewAppointment = {
  id: string;
  day: string;
  time: string;
  purpose: string;
  teacher: string;
  note: string;
  status: "SCHEDULED" | "ATTENDED" | "CANCELLED";
};
const EXAMPLES: PreviewAppointment[] = [
  {
    id: "support",
    day: "15 out",
    time: "14h–14h45",
    purpose: "Reforço",
    teacher: "Beatriz Albuquerque",
    note: "Praticar a organização de frases a partir da última produção escrita.",
    status: "SCHEDULED",
  },
  {
    id: "makeup",
    day: "20 out",
    time: "10h–11h",
    purpose: "Reposição",
    teacher: "Rafael Lima",
    note: "Retomar o conteúdo da aula perdida e realizar a atividade de compreensão oral.",
    status: "SCHEDULED",
  },
  {
    id: "support-past",
    day: "08 out",
    time: "14h–14h45",
    purpose: "Reforço",
    teacher: "Beatriz Albuquerque",
    note: "Conseguiu iniciar o exercício após a retomada das instruções.",
    status: "ATTENDED",
  },
  {
    id: "makeup-past",
    day: "01 out",
    time: "10h–11h",
    purpose: "Reposição",
    teacher: "Rafael Lima",
    note: "Conteúdo reposto e atividade concluída.",
    status: "ATTENDED",
  },
  {
    id: "cancelled-example",
    day: "24 set",
    time: "14h–14h45",
    purpose: "Reforço",
    teacher: "Beatriz Albuquerque",
    note: "Encontro cancelado a pedido da família.",
    status: "CANCELLED",
  },
];

export function scenarioAppointments(scenario: AppointmentScenario): PreviewAppointment[] {
  const counts = { empty: 0, one: 1, few: 2, several: EXAMPLES.length };
  return EXAMPLES.slice(0, counts[scenario]);
}

export function AppointmentPreview({
  rows,
  studentId,
  compact = false,
}: {
  rows: PreviewAppointment[];
  studentId: string;
  compact?: boolean;
}): ReactElement {
  if (rows.length === 0) return <></>;
  return (
    <section
      className={styles.appointments}
      data-compact={compact}
      aria-label="Atendimentos de exemplo"
    >
      <header className={styles.appointmentHeading}>
        <div>
          <h3>
            <CalendarDays aria-hidden="true" />
            Atendimentos <span>{rows.length}</span>
          </h3>
          {!compact && <p>Reposições, reforço e apoio ao aluno</p>}
        </div>
        <Button
          variant="link"
          size="inline"
          nativeButton={false}
          render={<Link href={`/aulas?aluno=${studentId}`} target="_blank" />}
        >
          Ver agenda <ArrowUpRight aria-hidden="true" />
        </Button>
      </header>
      {compact ? <AppointmentCarousel rows={rows} /> : <AppointmentList rows={rows} />}
    </section>
  );
}

function AppointmentList({ rows }: { rows: PreviewAppointment[] }): ReactElement {
  return (
    <div className={styles.appointmentList}>
      {rows.map((row) => (
        <details key={row.id} className={styles.appointment}>
          <summary>
            <span className={styles.appointmentDate}>
              {row.day}
              <small>{row.time}</small>
            </span>
            <span className={styles.appointmentPurpose}>
              <strong>{row.purpose}</strong>
              <small>{row.teacher}</small>
            </span>
            <PreviewStatus status={row.status} />
            <ChevronDown aria-hidden="true" />
          </summary>
          <p>{row.note}</p>
        </details>
      ))}
    </div>
  );
}

type CarouselControls = {
  rail: RefObject<HTMLUListElement | null>;
  edges: { start: boolean; end: boolean };
  measure: () => void;
  scroll: (direction: number) => void;
};
function useCarousel(itemCount: number): CarouselControls {
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  function measure(): void {
    const node = rail.current;
    if (node)
      setEdges({
        start: node.scrollLeft <= 1,
        end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 1,
      });
  }
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    return () => observer.disconnect();
  }, [itemCount]);
  const scroll = (direction: number): void => {
    rail.current?.scrollBy({ left: direction * rail.current.clientWidth });
  };
  return { rail, edges, measure, scroll };
}

function AppointmentCarousel({ rows }: { rows: PreviewAppointment[] }): ReactElement {
  const { rail, edges, measure, scroll } = useCarousel(rows.length);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId);
  return (
    <div className={styles.carousel}>
      <CarouselNavigation edges={edges} scroll={scroll} />
      <ul
        ref={rail}
        className={styles.carouselRail}
        data-count={rows.length}
        onScroll={measure}
        aria-label="Datas e motivos dos atendimentos"
      >
        {rows.map((row) => (
          <li key={row.id}>
            <AppointmentCell
              row={row}
              selected={selectedId === row.id}
              onSelect={() => setSelectedId(selectedId === row.id ? null : row.id)}
            />
          </li>
        ))}
      </ul>
      {selected && (
        <div className={styles.carouselDetail}>
          <p>
            <strong>
              {selected.purpose} · {selected.day} · {selected.time}
            </strong>
            <span>{selected.teacher}</span>
          </p>
          <p>{selected.note}</p>
          <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
            Fechar detalhe
          </Button>
        </div>
      )}
    </div>
  );
}

function AppointmentCell({
  row,
  selected,
  onSelect,
}: {
  row: PreviewAppointment;
  selected: boolean;
  onSelect: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={styles.carouselCell}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.cellDate}>
        <strong>{row.day.split(" ")[0]}</strong>
        <span>{row.day.split(" ").slice(1).join(" ")}</span>
      </span>
      <span className={styles.cellBody}>
        <strong>{row.purpose}</strong>
        <span>{row.note}</span>
        <span className={styles.cellMeta}>
          <small>{row.time}</small>
          <PreviewStatus status={row.status} />
        </span>
      </span>
    </button>
  );
}

function CarouselNavigation({
  edges,
  scroll,
}: Pick<CarouselControls, "edges" | "scroll">): ReactElement | null {
  if (edges.start && edges.end) return null;
  return (
    <div className={styles.carouselNavigation}>
      <span>Mais atendimentos</span>
      <div>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Atendimentos anteriores"
          disabled={edges.start}
          onClick={() => scroll(-1)}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Próximos atendimentos"
          disabled={edges.end}
          onClick={() => scroll(1)}
        >
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function PreviewStatus({ status }: { status: PreviewAppointment["status"] }): ReactElement {
  if (status === "ATTENDED") return <Badge variant="success">Realizado</Badge>;
  if (status === "CANCELLED") return <Badge variant="destructive">Cancelado</Badge>;
  return <Badge variant="info">Agendado</Badge>;
}
