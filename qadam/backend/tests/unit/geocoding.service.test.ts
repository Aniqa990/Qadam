import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for geocoding.service (AGENTS.md "Location fields").
 * The HTTP layer is module-mocked so no real provider is hit:
 *   - searchLocations must map Nominatim results to {label, lat, lng} and
 *     degrade to [] on provider failure (search is a convenience, manual
 *     pin-dropping must keep working).
 *   - reverseGeocode must prefer BigDataCloud and fall back to Nominatim,
 *     returning null (never throwing) when both fail so a geocoder outage
 *     can't block a profile/project save.
 */

vi.mock("../../src/config/ai", () => ({
  aiConfig: { bigDataCloud: { apiKey: "test-bdc-key" } },
}));

vi.mock("../../src/lib/http", () => ({
  httpJson: vi.fn(),
}));

import { httpJson } from "../../src/lib/http";
import { aiConfig } from "../../src/config/ai";
import { reverseGeocode, searchLocations } from "../../src/services/geocoding.service";

const httpJsonMock = vi.mocked(httpJson);

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const BDC_REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

beforeEach(() => {
  httpJsonMock.mockReset();
  (aiConfig as { bigDataCloud: { apiKey: string } }).bigDataCloud.apiKey = "test-bdc-key";
});

// -- searchLocations -----------------------------------------------------------

describe("searchLocations", () => {
  it("maps Nominatim results to {label, lat, lng} suggestions", async () => {
    httpJsonMock.mockResolvedValueOnce([
      { display_name: "Karachi, Karachi District, Sindh, Pakistan", lat: "24.8607", lon: "67.0011" },
      { display_name: "Jeddah, Makkah Region, Saudi Arabia", lat: "21.4858", lon: "39.1925" },
    ]);

    const suggestions = await searchLocations("karachi");

    expect(suggestions).toEqual([
      { label: "Karachi, Karachi District, Sindh, Pakistan", lat: 24.8607, lng: 67.0011 },
      { label: "Jeddah, Makkah Region, Saudi Arabia", lat: 21.4858, lng: 39.1925 },
    ]);
  });

  it("encodes the query and caps the result count", async () => {
    httpJsonMock.mockResolvedValueOnce([]);

    await searchLocations("new york city");

    expect(httpJsonMock).toHaveBeenCalledWith(
      expect.stringContaining(`${NOMINATIM_SEARCH_URL}?q=new%20york%20city`),
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.any(String) }),
      })
    );
    const url = httpJsonMock.mock.calls[0]![0];
    expect(url).toContain("format=jsonv2");
    expect(url).toContain("limit=6");
  });

  it("drops malformed or out-of-range results instead of failing", async () => {
    httpJsonMock.mockResolvedValueOnce([
      { display_name: "Valid Place, Country", lat: "10.5", lon: "20.5" },
      { display_name: null, lat: "1", lon: "2" }, // no label
      { display_name: "Broken coords, Country", lat: "not-a-number", lon: "2" },
      { display_name: "Out of range, Country", lat: "120", lon: "2" }, // |lat| > 90
      { display_name: "Out of range, Country", lat: "5", lon: "-200" }, // |lng| > 180
    ]);

    const suggestions = await searchLocations("place");

    expect(suggestions).toEqual([{ label: "Valid Place, Country", lat: 10.5, lng: 20.5 }]);
  });

  it("returns [] (never throws) when the provider fails", async () => {
    httpJsonMock.mockRejectedValueOnce(new Error("HTTP 503"));

    await expect(searchLocations("karachi")).resolves.toEqual([]);
  });

  it("returns [] when the provider returns a non-array", async () => {
    httpJsonMock.mockResolvedValueOnce({ error: "unexpected object" });

    await expect(searchLocations("karachi")).resolves.toEqual([]);
  });
});

// -- reverseGeocode ------------------------------------------------------------

describe("reverseGeocode", () => {
  it("resolves 'City, Country' via BigDataCloud first", async () => {
    httpJsonMock.mockResolvedValueOnce({ city: "Karachi", countryName: "Pakistan" });

    await expect(reverseGeocode(24.8607, 67.0011)).resolves.toBe("Karachi, Pakistan");
    expect(httpJsonMock).toHaveBeenCalledTimes(1);
    expect(httpJsonMock.mock.calls[0]![0]).toContain(BDC_REVERSE_URL);
  });

  it("uses locality when BigDataCloud omits city", async () => {
    httpJsonMock.mockResolvedValueOnce({ locality: "Gulshan", countryName: "Pakistan" });

    await expect(reverseGeocode(24.9, 67.1)).resolves.toBe("Gulshan, Pakistan");
  });

  it("falls back to Nominatim when BigDataCloud returns no city/country", async () => {
    httpJsonMock
      .mockResolvedValueOnce({ city: null, countryName: null })
      .mockResolvedValueOnce({ address: { city: "Jeddah", country: "Saudi Arabia" } });

    await expect(reverseGeocode(21.4858, 39.1925)).resolves.toBe("Jeddah, Saudi Arabia");
    expect(httpJsonMock.mock.calls[1]![0]).toContain(NOMINATIM_REVERSE_URL);
  });

  it("falls back to Nominatim when BigDataCloud errors", async () => {
    httpJsonMock
      .mockRejectedValueOnce(new Error("HTTP 429"))
      .mockResolvedValueOnce({ address: { town: "Islamabad", country: "Pakistan" } });

    await expect(reverseGeocode(33.6844, 73.0479)).resolves.toBe("Islamabad, Pakistan");
  });

  it("skips BigDataCloud entirely when the key is a placeholder", async () => {
    (aiConfig as { bigDataCloud: { apiKey: string } }).bigDataCloud.apiKey = "placeholder";
    httpJsonMock.mockResolvedValueOnce({ address: { village: "Hunza", country: "Pakistan" } });

    await expect(reverseGeocode(36.3167, 74.65)).resolves.toBe("Hunza, Pakistan");
    expect(httpJsonMock).toHaveBeenCalledTimes(1);
    expect(httpJsonMock.mock.calls[0]![0]).toContain(NOMINATIM_REVERSE_URL);
  });

  it("returns null (never throws) when every provider fails", async () => {
    httpJsonMock
      .mockRejectedValueOnce(new Error("BDC down"))
      .mockRejectedValueOnce(new Error("Nominatim down"));

    await expect(reverseGeocode(1, 1)).resolves.toBeNull();
  });
});
