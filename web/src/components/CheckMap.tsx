"use client";

import maplibregl, { type ImageSource } from "maplibre-gl";
import { useEffect, useRef } from "react";

type Bounds = [number, number, number, number]; // west, south, east, north

export type CheckLayers = { satellite: boolean; water: boolean; flood: boolean };
export type CatalogLake = { id: string; name: string; state: string; near?: string; lat: number; lon: number; ha: number };

type Props = {
  pin: [number, number] | null; // lon, lat
  onPick?: (lon: number, lat: number) => void; // tap to drop a pin; omit to lock the pin
  window?: Bounds; // the analysed 1.2 km window
  satelliteUrl?: string;
  waterUrl?: string;
  flood?: { url: string; bounds: Bounds } | null;
  layers: CheckLayers;
  lakes?: CatalogLake[]; // the India catalogue, drawn as blue circles of roughly the lake's size
};

function lakesGeoJson(lakes: CatalogLake[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: lakes.map((l) => ({
      type: "Feature",
      properties: { name: l.name, place: [l.near, l.state].filter(Boolean).join(", "), ha: l.ha, r: Math.sqrt((l.ha * 10000) / Math.PI) },
      geometry: { type: "Point", coordinates: [l.lon, l.lat] },
    })),
  };
}

// Circle radius in pixels for a lake of radius r metres: metres per pixel at zoom z
// is about 151,000 / 2^z at India's latitudes. Never smaller than a visible dot.
const LAKE_RADIUS: maplibregl.ExpressionSpecification = [
  "interpolate", ["exponential", 2], ["zoom"],
  4, ["max", 2.5, ["*", ["get", "r"], 16 / 151000]],
  18, ["max", 7, ["*", ["get", "r"], 262144 / 151000]],
];

const DELHI: [number, number] = [77.209, 28.6139];
const corners = ([w, s, e, n]: Bounds) =>
  [[w, n], [e, n], [e, s], [w, s]] as [[number, number], [number, number], [number, number], [number, number]];
const BLANK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function setImage(m: maplibregl.Map, id: string, url: string | undefined, bounds: Bounds | undefined, on: boolean) {
  const src = m.getSource(id) as ImageSource | undefined;
  if (!src) return;
  if (url && bounds) src.updateImage({ url, coordinates: corners(bounds) });
  m.setLayoutProperty(id, "visibility", url && bounds && on ? "visible" : "none");
}

function apply(m: maplibregl.Map, p: Props) {
  setImage(m, "satellite", p.satelliteUrl, p.window, p.layers.satellite);
  setImage(m, "water", p.waterUrl, p.window, p.layers.water);
  setImage(m, "flood", p.flood?.url, p.flood?.bounds, p.layers.flood);
  (m.getSource("window") as maplibregl.GeoJSONSource | undefined)?.setData(
    p.window
      ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...corners(p.window), corners(p.window)[0]]] } }
      : { type: "FeatureCollection", features: [] },
  );
}

export default function CheckMap(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const ready = useRef(false);
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    if (!el.current) return;
    const placeholder = [0, 0, 0.001, 0.001] as Bounds;
    const m = new maplibregl.Map({
      container: el.current,
      center: p.pin ?? DELHI,
      zoom: p.pin ? 15 : 11,
      maxZoom: 18,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors · Contains modified Copernicus Sentinel data",
          },
          satellite: { type: "image", url: BLANK, coordinates: corners(placeholder) },
          water: { type: "image", url: BLANK, coordinates: corners(placeholder) },
          flood: { type: "image", url: BLANK, coordinates: corners(placeholder) },
          window: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          lakes: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.6 } },
          {
            id: "lakes", type: "circle", source: "lakes",
            paint: {
              "circle-radius": LAKE_RADIUS,
              "circle-color": "#1e78dc",
              "circle-opacity": 0.28,
              "circle-stroke-color": "#1e78dc",
              "circle-stroke-width": 1.5,
              "circle-stroke-opacity": 0.9,
            },
          },
          { id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } },
          { id: "water", type: "raster", source: "water", layout: { visibility: "none" }, paint: { "raster-resampling": "nearest" } },
          { id: "flood", type: "raster", source: "flood", layout: { visibility: "none" }, paint: { "raster-opacity": 0.85 } },
          { id: "window", type: "line", source: "window", paint: { "line-color": "#ffffff", "line-width": 1.5, "line-dasharray": [2, 2] } },
        ],
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 120 }), "bottom-left");
    m.on("load", () => {
      ready.current = true;
      apply(m, latest.current);
    });
    m.on("click", (e) => latest.current.onPick?.(e.lngLat.lng, e.lngLat.lat));
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
    m.on("mousemove", "lakes", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const { name, place, ha } = f.properties as { name: string; place: string; ha: number };
      const size = ha >= 100 ? `${Math.round(ha).toLocaleString("en-IN")} ha` : `${Number(ha).toFixed(1)} ha`;
      const el = document.createElement("div");
      el.className = "lake-pop";
      el.append(Object.assign(document.createElement("strong"), { textContent: name }));
      el.append(Object.assign(document.createElement("span"), { textContent: ` · ${place} · about ${size}` }));
      popup.setLngLat(e.lngLat).setDOMContent(el).addTo(m);
    });
    m.on("mouseleave", "lakes", () => popup.remove());
    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
    };
    // Created once; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pin marker; fly to it when it moves.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!p.pin) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ color: "#1f5c3f" }).setLngLat(p.pin).addTo(m);
    } else {
      marker.current.setLngLat(p.pin);
    }
    if (p.window) {
      m.fitBounds([[p.window[0], p.window[1]], [p.window[2], p.window[3]]], { padding: 24, duration: 700 });
    } else {
      m.easeTo({ center: p.pin, zoom: Math.max(m.getZoom(), 15), duration: 700 });
    }
  }, [p.pin?.[0], p.pin?.[1], p.window?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (map.current && ready.current) apply(map.current, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.satelliteUrl, p.waterUrl, p.flood?.url, p.window?.join(","), p.layers]);

  useEffect(() => {
    if (map.current) map.current.getCanvas().style.cursor = p.onPick ? "crosshair" : "";
  }, [p.onPick]);

  useEffect(() => {
    const m = map.current;
    if (!m || !p.lakes) return;
    const set = () => (m.getSource("lakes") as maplibregl.GeoJSONSource | undefined)?.setData(lakesGeoJson(p.lakes!));
    if (ready.current) set();
    else m.once("load", set);
  }, [p.lakes]);

  return <div ref={el} className="map check-map" />;
}
