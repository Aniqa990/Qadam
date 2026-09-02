/**
 * MapLibre GL + OpenFreeMap configuration (see architecture.md "Maps" and
 * AGENTS.md's location-fields rule). OpenFreeMap serves free public vector
 * tiles with no API key or request quota, so there's no secret to manage
 * here - just a shared style URL so every map component stays consistent.
 *
 * Actual <Map> components land in Phase 3 (volunteer location pinning) and
 * Phase 8 (project/NGO map displays). This file just centralizes the config
 * so those components import from one place instead of hardcoding the URL.
 */
export const mapConfig = {
  styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  defaultCenter: { lng: 67.0011, lat: 24.8607 }, // Karachi, Pakistan
  defaultZoom: 11,
};
