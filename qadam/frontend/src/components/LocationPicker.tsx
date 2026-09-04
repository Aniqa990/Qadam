import { useEffect, useId, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import { Loader2, Search } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapConfig } from "@/lib/map";
import { searchLocations, type LocationSuggestion } from "@/lib/geocoding";
import { useApi } from "@/hooks/useApi";
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

/** Debounce + minimum length keep the geocoding request volume polite. */
const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

/**
 * MapLibre GL + OpenFreeMap pin picker (AGENTS.md "Location fields" /
 * frontend-routes.md "Location & Map Behavior"). Interactive flow:
 * search a place -> pick a suggestion (map flies there, pin updates) ->
 * optionally fine-tune by dragging the marker or clicking the map. Only the
 * coordinates leave this component; the backend resolves and caches the
 * "City, Country" label from the final pin. Read-only mode renders the stored
 * pin for display, with no search box.
 */
export default function LocationPicker({ value, onChange, readOnly = false, className }: LocationPickerProps) {
  const { api } = useApi();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const positionedRef = useRef(false);
  // Keep the latest handler without re-initializing the map on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // -- place search state ------------------------------------------------------
  const inputId = useId();
  const listId = useId();
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const searchSeqRef = useRef(0);
  // Selecting a suggestion writes its label into the input; that write must
  // not trigger another search for the label itself.
  const skipNextSearchRef = useRef(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

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

  // Debounced place search: fires once typing pauses; responses from an
  // earlier keystroke are discarded via the sequence counter.
  useEffect(() => {
    if (readOnly) return;
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setSearchError(null);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const timer = window.setTimeout(async () => {
      const seq = ++searchSeqRef.current;
      setSearching(true);
      try {
        const results = await searchLocations(api, trimmed);
        if (seq !== searchSeqRef.current) return; // a newer keystroke won
        setSuggestions(results);
        setSearchError(null);
        setOpen(true);
        setActiveIndex(results.length > 0 ? 0 : -1);
      } catch (err) {
        if (seq !== searchSeqRef.current) return;
        setSuggestions([]);
        setSearchError(
          err instanceof Error ? err.message : "Location search is unavailable right now."
        );
        setOpen(false);
      } finally {
        if (seq === searchSeqRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, readOnly, api]);

  // Close the suggestion dropdown when clicking anywhere outside the search box.
  useEffect(() => {
    if (readOnly) return;
    function handlePointerDown(event: MouseEvent) {
      if (!searchBoxRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [readOnly]);

  /**
   * Selecting a suggestion centers the map on the place, moves the pin, and
   * reports the new coordinates upward - the start of the "optional pin
   * adjustment" step, not the end of the flow.
   */
  function selectSuggestion(suggestion: LocationSuggestion) {
    const map = mapRef.current;
    const marker = markerRef.current;
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setSearchError(null);
    skipNextSearchRef.current = true;
    setQuery(suggestion.label);

    if (map && marker) {
      // Mark as positioned so the value-sync effect above doesn't jumpTo over
      // this flight with the same coordinates.
      positionedRef.current = true;
      marker.setLngLat([suggestion.lng, suggestion.lat]).addTo(map);
      map.flyTo({ center: [suggestion.lng, suggestion.lat], zoom: 14, essential: true });
    }
    onChangeRef.current?.({ lat: suggestion.lat, lng: suggestion.lng });
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
        // Always intercept Enter while the dropdown is open so picking a
        // place never submits the surrounding form.
        event.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          selectSuggestion(suggestions[activeIndex]);
        }
        break;
    }
  }

  return (
    <div>
      {!readOnly && (
        <div ref={searchBoxRef} className="relative mb-2">
          <label htmlFor={inputId} className="sr-only">
            Search for a place
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search a city or place..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searching && (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          )}

          {open && suggestions.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Place suggestions"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-input bg-background py-1 shadow-lg"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.lat},${suggestion.lng},${index}`}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  // onMouseDown (not onClick) so the input never loses focus
                  // mid-click, which would unmount the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm",
                    index === activeIndex ? "bg-secondary" : "bg-transparent"
                  )}
                >
                  <span className="block truncate">{suggestion.label}</span>
                </li>
              ))}
            </ul>
          )}
          {open && !searching && suggestions.length === 0 && (
            <p className="absolute z-20 mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground shadow-lg">
              No matching places. Try a different spelling, or drop the pin manually.
            </p>
          )}
        </div>
      )}
      {searchError && (
        <p className="mb-2 text-xs text-destructive" role="alert">
          {searchError} You can still drop the pin manually on the map.
        </p>
      )}

      <div
        ref={containerRef}
        role="application"
        aria-label={readOnly ? "Project location map" : "Location map - search, click, or drag to set the pin"}
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
          `Selected pin: ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)} — drag the marker or click the map to fine-tune.`
        ) : (
          "Search for a place above, or click the map to drop the exact pin."
        )}
      </p>
    </div>
  );
}
