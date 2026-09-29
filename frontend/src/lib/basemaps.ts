/**
 * Base map catalogue.
 *
 * Deliberately kept out of LeafletMap.tsx. Leaflet reads `window` at import
 * time, so any module that imports a constant from the map component drags the
 * whole library into the server bundle and breaks prerendering. This module has
 * no imports at all, so both the server shell and the map component can read it.
 *
 * Both services are public and keyless. They replace the previous CARTO
 * `basemaps.cartocdn.com` layer, which now injects an "API KEY REQUIRED"
 * watermark into every tile served to an unregistered domain. Attributions are
 * the ones each provider's terms require.
 */

export type BasemapId = "satellite" | "street";

export interface Basemap {
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

export const BASEMAPS: Record<BasemapId, Basemap> = {
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
  street: {
    label: "Street",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};

export const BASEMAP_IDS = Object.keys(BASEMAPS) as BasemapId[];
