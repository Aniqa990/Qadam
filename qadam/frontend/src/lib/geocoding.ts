import type { ApiFetcher } from "./projects";

/**
 * Shape returned by GET /api/geocoding/search (api-contracts.md "Geocoding
 * Module"). Mirrors the backend's LocationSuggestion in
 * services/geocoding.service.ts - keep them in sync.
 */
export interface LocationSuggestion {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Searches for places by free text so the location pickers can offer
 * "search -> select -> fine-tune the pin" (frontend-routes.md "Location &
 * Map Behavior"). Suggestions only move the map/pin - the persisted
 * location_name is always re-resolved server-side from the final pin.
 */
export function searchLocations(api: ApiFetcher, query: string): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  return api<LocationSuggestion[]>(`/geocoding/search?${params.toString()}`);
}
