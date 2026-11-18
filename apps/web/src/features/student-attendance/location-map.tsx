"use client";
import type { ReactElement } from "react";
import { Crosshair, Minus, Plus } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { useLocationMap } from "./use-location-map";
import type { SchoolPoint } from "./settings-values";
import "maplibre-gl/dist/maplibre-gl.css";
import styles from "./settings.module.css";

type Props = {
  point: SchoolPoint | null;
  radius: number | null;
  disabled: boolean;
  onPoint: (point: SchoolPoint) => void;
  focusVersion: number;
};

export function SchoolLocationMap(props: Props): ReactElement | null {
  const map = useLocationMap(props);
  if (map.state === "error") return null;
  const ready = map.state === "ready";
  const locked = props.disabled || !ready;
  return (
    <section className={styles.mapFrame} aria-label="Mapa e área de presença da escola">
      <div ref={map.container} className={styles.mapCanvas} />
      {map.state === "loading" && (
        <div className={styles.mapNotice} role="status">
          <InlineSkeleton shape="block" className="h-4 w-4" />
          <span>Carregando mapa…</span>
        </div>
      )}
      {ready && (
        <p className={styles.mapHint}>Clique no mapa ou arraste o pino para ajustar a entrada.</p>
      )}
      <div className={styles.mapControls} aria-label="Controles do mapa">
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Ampliar mapa"
          disabled={locked}
          onClick={map.zoomIn}
        >
          <Plus aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Reduzir mapa"
          disabled={locked}
          onClick={map.zoomOut}
        >
          <Minus aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Centralizar na escola"
          disabled={locked || !props.point}
          onClick={map.recenter}
        >
          <Crosshair aria-hidden="true" />
        </Button>
      </div>
      {props.point && props.radius && ready && (
        <div className={styles.mapLegend}>
          <span aria-hidden="true" />
          <span>
            Área aceita <strong>{props.radius} m</strong>
          </span>
        </div>
      )}
    </section>
  );
}
