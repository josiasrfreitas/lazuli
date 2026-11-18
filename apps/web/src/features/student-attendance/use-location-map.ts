"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Map as LocationMap, Marker, GeoJSONSource } from "maplibre-gl";
import { schoolArea } from "./location-map-model";
import { DEFAULT_RADIUS_METERS, type SchoolPoint } from "./settings-values";

const BRAZIL_LONGITUDE = -52;
const BRAZIL_LATITUDE = -14;
const BRAZIL_CENTER: [number, number] = [BRAZIL_LONGITUDE, BRAZIL_LATITUDE];
const AREA_SOURCE = "school-area";
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

function areaData(
  point: SchoolPoint | null,
  radius: number | null,
): ReturnType<typeof schoolArea> | { type: "FeatureCollection"; features: [] } {
  return point && radius ? schoolArea(point, radius) : { type: "FeatureCollection", features: [] };
}

export function useLocationMap(input: MapInput): {
  container: RefObject<HTMLDivElement | null>;
  state: MapState;
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
} {
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
    const lifecycle = { disposed: false, failed: false };
    let resize: ResizeObserver | undefined;
    setState("loading");
    void import("maplibre-gl")
      .then((library) => {
        if (lifecycle.disposed) return;
        resize = installMap(library, {
          element,
          map,
          marker,
          latest,
          fitArea,
          synchronize,
          lifecycle,
          setState,
        });
      })
      .catch(() => {
        if (!lifecycle.disposed) setState("error");
      });
    return () => {
      lifecycle.disposed = true;
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
    if (map.current?.getSource(AREA_SOURCE)) fitArea.current?.();
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

type MapLibrary = typeof import("maplibre-gl");
type MapLifecycle = { disposed: boolean; failed: boolean };
type MapBindings = {
  latest: RefObject<MapInput>;
  marker: RefObject<Marker | null>;
  fitArea: RefObject<(() => void) | null>;
  synchronize: RefObject<(() => void) | null>;
  lifecycle: MapLifecycle;
  setState: (state: MapState) => void;
};

function installMap(
  library: MapLibrary,
  {
    element,
    map,
    marker,
    latest,
    fitArea,
    synchronize,
    lifecycle,
    setState,
  }: MapBindings & { element: HTMLDivElement; map: RefObject<LocationMap | null> },
): ResizeObserver {
  library.setWorkerUrl(
    new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
  );
  const current = latest.current;
  const instance = new library.Map({
    container: element,
    style: `/api/school-map/v2/styles/Standard/descriptor?v=2&theme=${document.documentElement.classList.contains("dark") ? "dark" : "light"}`,
    transformRequest: (url) => ({ url: new URL(url, globalThis.location.href).toString() }),
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
  const mapContext = { library, instance, color, latest };
  fitArea.current = mapAreaFocus(mapContext, reducedMotion);
  synchronize.current = mapMarkerSync(mapContext, marker);
  attachMapEvents(instance, { color, latest, fitArea, synchronize, lifecycle, setState });
  const resize = new ResizeObserver(() => instance.resize());
  resize.observe(element);
  return resize;
}

type MapContext = {
  library: MapLibrary;
  instance: LocationMap;
  color: string;
  latest: RefObject<MapInput>;
};

function mapAreaFocus(
  { library, instance, latest }: MapContext,
  reducedMotion: boolean,
): () => void {
  return (): void => {
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
        radius ?? DEFAULT_RADIUS_METERS,
      ),
      { padding: 72, maxZoom: 18, duration: reducedMotion ? 0 : MAP_TRANSITION_MS },
    );
  };
}

function mapMarkerSync(
  { library, instance, color, latest }: MapContext,
  marker: RefObject<Marker | null>,
): () => void {
  return (): void => {
    if (!instance.getSource(AREA_SOURCE)) return;
    const { point, radius, disabled } = latest.current;
    void (instance.getSource(AREA_SOURCE) as GeoJSONSource).setData(areaData(point, radius));
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
}

function attachMapEvents(
  instance: LocationMap,
  {
    color,
    latest,
    fitArea,
    synchronize,
    lifecycle,
    setState,
  }: Omit<MapBindings, "marker"> & { color: string },
): void {
  instance.on("load", () => {
    if (lifecycle.disposed || lifecycle.failed) return;
    void instance.addSource(AREA_SOURCE, {
      type: "geojson",
      data: areaData(latest.current.point, latest.current.radius),
    });
    void instance.addLayer({
      id: "school-area-fill",
      type: "fill",
      source: AREA_SOURCE,
      paint: { "fill-color": color, "fill-opacity": 0.14 },
    });
    void instance.addLayer({
      id: "school-area-outline",
      type: "line",
      source: AREA_SOURCE,
      paint: { "line-color": color, "line-width": 2 },
    });
    synchronize.current?.();
    if (latest.current.point) fitArea.current?.();
    setState("ready");
  });
  instance.on("error", () => {
    if (!lifecycle.disposed) {
      lifecycle.failed = true;
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
}
