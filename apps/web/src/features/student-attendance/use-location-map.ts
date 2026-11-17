"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LocationMap, Marker, GeoJSONSource } from "maplibre-gl";
import { schoolArea } from "./location-map-model";
import type { SchoolPoint } from "./settings-values";

const BRAZIL_CENTER: [number, number] = [-52, -14];
const COUNTRY_ZOOM = 3;
const ENTRANCE_ZOOM = 17;
const MAP_TRANSITION_MS = 400;
const MAX_MERCATOR_LATITUDE = 85;
type MapInput = {
  point: SchoolPoint | null;
  radius: number | null;
  disabled: boolean;
  onPoint: (point: SchoolPoint) => void;
  focusVersion: number;
};
type MapState = "loading" | "ready" | "error";

function areaData(point: SchoolPoint | null, radius: number | null) {
  return point && radius
    ? schoolArea(point, radius)
    : { type: "FeatureCollection" as const, features: [] };
}

export function useLocationMap(input: MapInput) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LocationMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const latest = useRef(input);
  latest.current = input;
  const [state, setState] = useState<MapState>("loading");
  const unavailable = state === "error";
  const synchronize = useRef<(() => void) | null>(null);
  const fitArea = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (unavailable) return;
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let failed = false;
    let resize: ResizeObserver | undefined;
    setState("loading");
    void import("maplibre-gl")
      .then((library) => {
        if (disposed) return;
        library.setWorkerUrl(
          new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
        );
        const current = latest.current;
        const instance = new library.Map({
          container: element,
          style: `/api/school-map/v2/styles/Standard/descriptor?v=2&theme=${document.documentElement.classList.contains("dark") ? "dark" : "light"}`,
          transformRequest: (url) => ({ url: new URL(url, window.location.href).toString() }),
          center: current.point ? [current.point.longitude, current.point.latitude] : BRAZIL_CENTER,
          zoom: current.point ? ENTRANCE_ZOOM : COUNTRY_ZOOM,
          attributionControl: false,
        });
        map.current = instance;
        instance.addControl(new library.AttributionControl({ compact: true }));
        instance
          .getCanvas()
          .setAttribute(
            "aria-label",
            "Mapa da escola. Use as setas para navegar e Enter para marcar a entrada.",
          );
        const color = getComputedStyle(element).getPropertyValue("--interactive").trim();
        const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
        fitArea.current = (): void => {
          const { point, radius } = latest.current;
          if (!point) {
            instance.easeTo({
              center: BRAZIL_CENTER,
              zoom: COUNTRY_ZOOM,
              duration: reducedMotion ? 0 : MAP_TRANSITION_MS,
            });
            return;
          }
          if (Math.abs(point.latitude) > MAX_MERCATOR_LATITUDE) return;
          instance.fitBounds(
            library.LngLatBounds.fromLngLat(
              new library.LngLat(point.longitude, point.latitude),
              radius ?? 200,
            ),
            { padding: 72, maxZoom: 18, duration: reducedMotion ? 0 : MAP_TRANSITION_MS },
          );
        };
        synchronize.current = (): void => {
          if (!instance.getSource("school-area")) return;
          const { point, radius, disabled } = latest.current;
          (instance.getSource("school-area") as GeoJSONSource).setData(areaData(point, radius));
          if (!point) {
            marker.current?.remove();
            marker.current = null;
            return;
          }
          if (!marker.current) {
            marker.current = new library.Marker({ color, draggable: !disabled })
              .setLngLat([point.longitude, point.latitude])
              .addTo(instance);
            marker.current.getElement().setAttribute("aria-label", "Entrada da escola");
            marker.current.on("dragend", () => {
              if (latest.current.disabled) return;
              const moved = marker.current!.getLngLat();
              latest.current.onPoint({ latitude: moved.lat, longitude: moved.lng });
            });
          }
          marker.current.setLngLat([point.longitude, point.latitude]).setDraggable(!disabled);
        };
        instance.on("load", () => {
          if (disposed || failed) return;
          instance.addSource("school-area", {
            type: "geojson",
            data: areaData(latest.current.point, latest.current.radius),
          });
          instance.addLayer({
            id: "school-area-fill",
            type: "fill",
            source: "school-area",
            paint: { "fill-color": color, "fill-opacity": 0.14 },
          });
          instance.addLayer({
            id: "school-area-outline",
            type: "line",
            source: "school-area",
            paint: { "line-color": color, "line-width": 2 },
          });
          synchronize.current?.();
          if (latest.current.point) fitArea.current?.();
          setState("ready");
        });
        instance.on("error", () => {
          if (!disposed) {
            failed = true;
            setState("error");
          }
        });
        instance.on("click", (event) => {
          if (latest.current.disabled) return;
          if (
            event.originalEvent.target instanceof Element &&
            event.originalEvent.target.closest(".maplibregl-marker")
          )
            return;
          latest.current.onPoint({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
        });
        instance.getCanvas().addEventListener("keydown", (event) => {
          if (event.key !== "Enter" || latest.current.disabled) return;
          event.preventDefault();
          const center = instance.getCenter();
          latest.current.onPoint({ latitude: center.lat, longitude: center.lng });
        });
        resize = new ResizeObserver(() => instance.resize());
        resize.observe(element);
      })
      .catch(() => {
        if (!disposed) setState("error");
      });
    return () => {
      disposed = true;
      resize?.disconnect();
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
      synchronize.current = null;
      fitArea.current = null;
    };
  }, [unavailable]);
  useEffect(() => {
    synchronize.current?.();
  }, [input.point?.latitude, input.point?.longitude, input.radius, input.disabled]);
  useEffect(() => {
    if (map.current?.getSource("school-area")) fitArea.current?.();
  }, [input.focusVersion]);
  return {
    container,
    state,
    zoomIn: (): void => {
      map.current?.zoomIn();
    },
    zoomOut: (): void => {
      map.current?.zoomOut();
    },
    recenter: (): void => {
      fitArea.current?.();
    },
  };
}
