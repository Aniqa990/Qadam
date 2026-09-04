import { aiConfig } from "../config/ai";
import { httpJson } from "../lib/http";
import { logger } from "../utils/logger";

/**
 * Reverse geocoding with BigDataCloud primary + Nominatim (OpenStreetMap)
 * fallback (AGENTS.md "Location fields"). Converts an exact map pin into the
 * canonical "City, Country" display label that gets cached in the row.
 * The pin itself remains the authoritative geographic data — this label
 * is display-only.
 *
 * Nominatim is the free, keyless OpenStreetMap reverse geocoder. It serves
 * as an automatic fallback when BigDataCloud is unavailable, rate-limited,
 * or configured with a placeholder key.
 */
interface BdcReverseGeocodeResponse {
  city?: string | null;
  locality?: string | null;
  principalSubdivision?: string | null;
  countryName?: string | null;
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
}

const BDC_REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/** A place suggestion for the location search box (GET /api/geocoding/search). */
export interface LocationSuggestion {
  label: string;
  lat: number;
  lng: number;
}

interface NominatimSearchResult {
  display_name?: string | null;
  lat?: string | null;
  lon?: string | null;
}

/** True when the BDC key is missing or still set to the placeholder value. */
function hasValidBdcKey(): boolean {
  const key = aiConfig.bigDataCloud.apiKey;
  return Boolean(key) && key !== "placeholder";
}

/** BigDataCloud primary geocoder. */
async function geocodeBigDataCloud(lat: number, lng: number): Promise<string | null> {
  const data = await httpJson<BdcReverseGeocodeResponse>(
    `${BDC_REVERSE_GEOCODE_URL}?latitude=${lat}&longitude=${lng}&localityLanguage=en&key=${aiConfig.bigDataCloud.apiKey}`,
    { timeoutMs: 8000 }
  );
  const city = data.city || data.locality || data.principalSubdivision;
  if (!city || !data.countryName) return null;
  return `${city}, ${data.countryName}`;
}

/** Nominatim (OpenStreetMap) fallback — free, no key needed. */
async function geocodeNominatim(lat: number, lng: number): Promise<string | null> {
  const data = await httpJson<NominatimResponse>(
    `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
    {
      timeoutMs: 8000,
      headers: { "User-Agent": "Qadam/1.0 (volunteer-platform)" },
    }
  );
  const addr = data.address;
  if (!addr) return null;
  const city = addr.city || addr.town || addr.village || addr.state;
  if (!city || !addr.country) return null;
  return `${city}, ${addr.country}`;
}

/**
 * Resolves coordinates to a "City, Country" string. Returns null (rather than
 * throwing) when both geocoders fail: a geocoder outage must never block
 * project creation — the caller stores the exact pin and simply leaves
 * location_name to be backfilled on the next update.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // Try BigDataCloud first if we have a valid key.
  if (hasValidBdcKey()) {
    try {
      const result = await geocodeBigDataCloud(lat, lng);
      if (result) return result;
      logger.warn("BigDataCloud returned no city/country, falling back to Nominatim", { lat, lng });
    } catch (err) {
      logger.warn("BigDataCloud failed, falling back to Nominatim", {
        lat,
        lng,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.info("BDC_API_KEY not configured, using Nominatim fallback");
  }

  // Nominatim fallback.
  try {
    const result = await geocodeNominatim(lat, lng);
    if (result) {
      logger.info("Reverse geocoded via Nominatim", { lat, lng, result });
      return result;
    }
    logger.warn("Nominatim returned no city/country for pin", { lat, lng });
    return null;
  } catch (err) {
    logger.warn("All reverse geocoding providers failed", {
      lat,
      lng,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Forward geocoding (place search) for the location pickers: converts a
 * free-text query like "karachi" into place suggestions the user can pick
 * before fine-tuning the exact pin. Serves the "search → select → adjust pin"
 * flow (AGENTS.md "Location fields"). Results are hints only — the pin stays
 * the authoritative data, and location_name is still resolved from the final
 * pin via reverseGeocode on save.
 *
 * Returns [] (rather than throwing) when the provider fails: search is a
 * convenience, so an outage degrades to manual pin-dropping instead of an
 * error the caller has to handle.
 */
export async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  const url =
    `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}` +
    `&format=jsonv2&limit=6&accept-language=en`;

  try {
    const results = await httpJson<NominatimSearchResult[]>(url, {
      timeoutMs: 8000,
      headers: { "User-Agent": "Qadam/1.0 (volunteer-platform)" },
    });

    return (Array.isArray(results) ? results : [])
      .map((result) => ({
        label: result.display_name?.trim() ?? "",
        lat: Number(result.lat),
        lng: Number(result.lon),
      }))
      .filter(
        (suggestion): suggestion is LocationSuggestion =>
          suggestion.label.length > 0 &&
          Number.isFinite(suggestion.lat) &&
          Number.isFinite(suggestion.lng) &&
          Math.abs(suggestion.lat) <= 90 &&
          Math.abs(suggestion.lng) <= 180
      );
  } catch (err) {
    logger.warn("Location search failed", {
      query,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
