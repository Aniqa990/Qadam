import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapConfig } from "@/lib/map";
import { cn } from "@/lib/utils";

export interface LatLng {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  /** Current pin position, or null before one is set. */
  value: LatLng | null;
  /** Omitted (or readOnly) for a display-only map, e.g. on the detail page. */
  onChange?: (value: LatLng) => void;
  readOnly?: boolean;
  className?: string;
}

/**
 * MapLibre GL + OpenFreeMap pin picker (AGENTS.md "Location fields" /
 * frontend-routes.md "Location & Map Behavior"). Interactive mode: click the
 * map or drag the marker to set the exact project pin - only the coordinates
 * leave this component; the backend resolves and caches the "City, Country"
 * label. Read-only mode renders the stored pin for display.
 */
export default function LocationPicker({ value, onChange, readOnly = false, className }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const positionedRef = useRef(false);
  // Keep the latest handler without re-initializing the map on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapConfig.styleUrl,
      center: value ? [value.lng, value.lat] : [mapConfig.defaultCenter.lng, mapConfig.defaultCenter.lat],
      zoom: value ? 13 : mapConfig.defaultZoom,
    });
    mapRef.current = map;
    positionedRef.current = Boolean(value);

    const marker = new Marker({ draggable: !readOnly });
    markerRef.current = marker;

    if (!readOnly) {
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");

      const commit = (lng: number, lat: number) => onChangeRef.current?.({ lat, lng });
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        commit(lngLat.lng, lngLat.lat);
      });
      map.on("click", (e) => {
        marker.setLngLat(e.lngLat).addTo(map);
        commit(e.lngLat.lng, e.lngLat.lat);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is initialized once per mode; value syncs via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Sync the marker when `value` arrives/changes from outside the map
  // (initial project load). User-driven changes already moved the marker.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !value) return;

    marker.setLngLat([value.lng, value.lat]).addTo(map);
    if (!positionedRef.current) {
      positionedRef.current = true;
      map.jumpTo({ center: [value.lng, value.lat], zoom: 13 });
    }
  }, [value]);

  return (
    <div>
      <div
        ref={containerRef}
        role="application"
        aria-label={readOnly ? "Project location map" : "Project location map - click or drag to set the pin"}
        className={cn("h-72 w-full rounded-md border border-input", className)}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {readOnly ? (
          value ? (
            `Exact pin: ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`
          ) : (
            "No location pin set."
          )
        ) : value ? (
          `Selected pin: ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)} — click the map or drag the marker to adjust.`
        ) : (
          "Click the map to drop the exact project pin."
        )}
      </p>
    </div>
  );
}
