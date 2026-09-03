import { aiConfig } from "../config/ai";
import { httpJson } from "../lib/http";
import { logger } from "../utils/logger";

/**
 * BigDataCloud reverse geocoding (server-side endpoint, per AGENTS.md
 * "Location fields"). Converts an exact map pin into the canonical
 * "City, Country" display label that gets cached in the row. The pin itself
 * remains the authoritative geographic data - this label is display-only.
 */
interface BdcReverseGeocodeResponse {
  city?: string | null;
  locality?: string | null;
  principalSubdivision?: string | null;
  countryName?: string | null;
}

const BDC_REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode";

/**
 * Resolves coordinates to a "City, Country" string. Returns null (rather than
 * throwing) when BigDataCloud fails or can't resolve the pin: a geocoder
 * outage must never block project creation - the caller stores the exact pin
 * and simply leaves location_name to be backfilled on the next update.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const data = await httpJson<BdcReverseGeocodeResponse>(
      `${BDC_REVERSE_GEOCODE_URL}?latitude=${lat}&longitude=${lng}&localityLanguage=en&key=${aiConfig.bigDataCloud.apiKey}`,
      { timeoutMs: 8000 }
    );

    const city = data.city || data.locality || data.principalSubdivision;
    if (!city || !data.countryName) {
      logger.warn("Reverse geocoding returned no city/country for pin", { lat, lng });
      return null;
    }
    return `${city}, ${data.countryName}`;
  } catch (err) {
    logger.warn("Reverse geocoding failed", {
      lat,
      lng,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
