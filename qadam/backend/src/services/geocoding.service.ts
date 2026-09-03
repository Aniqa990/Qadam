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
