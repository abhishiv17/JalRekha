"use client";

import maplibregl, { type GeoJSONSource, type ImageSource } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { FeatureCollection, FlagProps } from "@/lib/data";

export type Layers = { flags: boolean; outline: boolean; buffer: boolean; landcover: boolean; water: boolean };

type Props = {
  bounds: [number, number, number, number];
  imageUrl: string;
  overlayUrl: string;
  waterUrl: string; // GeoJSON of the open water seen that season
  layers: Layers;
  flags: FeatureCollection<FlagProps>;
  reference: FeatureCollection<{ kind: string; width_m?: number }>;
  bufferWidth: number;
  zoneFocus?: boolean; // "Show the zone on the map": fill and pulse the no-build ring
  focusFlag?: string | null;
  zoomTo?: string | null; // fly to this flag; null = whole lake
  onError?: (message: string) => void;
};

const corners = ([w, s, e, n]: Props["bounds"]) =>
  [[w, n], [e, n], [e, s], [w, s]] as [[number, number], [number, number], [number, number], [number, number]];
const FLAG = "#f5a524";

type Loaded = Partial<Record<"truecolor" | "overlay" | "water", string>>;

// Only (re)load an image or outline when its URL changes: reloading on every layer
// toggle cancels requests in flight, which used to surface as "could not be loaded".
function apply(m: maplibregl.Map, p: Props, loaded: Loaded) {
  if (loaded.truecolor !== p.imageUrl) {
    loaded.truecolor = p.imageUrl;
    (m.getSource("truecolor") as ImageSource | undefined)?.updateImage({ url: p.imageUrl, coordinates: corners(p.bounds) });
  }
  if (loaded.overlay !== p.overlayUrl) {
    loaded.overlay = p.overlayUrl;
    (m.getSource("overlay") as ImageSource | undefined)?.updateImage({ url: p.overlayUrl, coordinates: corners(p.bounds) });
  }
  const vis = (on: boolean) => (on ? "visible" : "none");
  m.setLayoutProperty("overlay", "visibility", vis(p.layers.landcover));
  if (loaded.water !== p.waterUrl) {
    loaded.water = p.waterUrl;
    (m.getSource("water") as GeoJSONSource | undefined)?.setData(p.waterUrl);
  }
  m.setLayoutProperty("water-fill", "visibility", vis(p.layers.water));
  m.setLayoutProperty("water-line", "visibility", vis(p.layers.water));
  m.setLayoutProperty("reference", "visibility", vis(p.layers.outline));
  m.setLayoutProperty("buffer", "visibility", vis(p.layers.buffer));
  m.setLayoutProperty("flags-fill", "visibility", vis(p.layers.flags));
  m.setLayoutProperty("flags", "visibility", vis(p.layers.flags));
  const ring: maplibregl.FilterSpecification = ["all", ["==", ["get", "kind"], "buffer"], ["==", ["get", "width_m"], p.bufferWidth]];
  m.setFilter("buffer", ring);
  m.setFilter("buffer-fill", ring);
  m.setLayoutProperty("buffer-fill", "visibility", vis(p.layers.buffer && !!p.zoneFocus));
  m.setPaintProperty("buffer", "line-width", p.zoneFocus ? 3 : 1.6);
  m.setPaintProperty("buffer", "line-color", p.zoneFocus ? "#ffe082" : "#d8f0e0");
  (m.getSource("flags") as GeoJSONSource | undefined)?.setData(p.flags as GeoJSON.FeatureCollection);
  m.setPaintProperty("flags", "line-width", ["case", ["==", ["get", "flag_id"], p.focusFlag ?? ""], 4, 2.5]);
  m.setPaintProperty("flags-fill", "fill-opacity", ["case", ["==", ["get", "flag_id"], p.focusFlag ?? ""], 0.45, 0.18]);
}

function zoom(m: maplibregl.Map, p: Props) {
  const f = p.zoomTo ? p.flags.features.find((x) => x.properties.flag_id === p.zoomTo) : null;
  if (!f) {
    m.fitBounds(p.bounds, { padding: 20, duration: 600 });
    return;
  }
  const g = f.geometry;
  const pts = (g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : []).flat();
  const xs = pts.map((c) => c[0]), ys = pts.map((c) => c[1]);
  m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 90, maxZoom: 17, duration: 800 });
}

export default function LakeMap(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const latest = useRef(p);
  latest.current = p;
  const loaded = useRef<Loaded>({});
  const retried = useRef<Partial<Record<"truecolor" | "overlay", string>>>({});

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      bounds: p.bounds,
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors",
          },
          truecolor: { type: "image", url: p.imageUrl, coordinates: corners(p.bounds) },
          overlay: { type: "image", url: p.overlayUrl, coordinates: corners(p.bounds) },
          reference: { type: "geojson", data: p.reference as GeoJSON.FeatureCollection },
          water: { type: "geojson", data: p.waterUrl },
          flags: { type: "geojson", data: p.flags as GeoJSON.FeatureCollection },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.7 } },
          { id: "truecolor", type: "raster", source: "truecolor", paint: { "raster-resampling": "nearest" } },
          { id: "overlay", type: "raster", source: "overlay", paint: { "raster-resampling": "nearest", "raster-opacity": 0.8 } },
          { id: "water-fill", type: "fill", source: "water", paint: { "fill-color": "#1e78dc", "fill-opacity": 0.6 } },
          { id: "water-line", type: "line", source: "water", paint: { "line-color": "#9fd0ff", "line-width": 1.2 } },
          {
            id: "buffer-fill",
            type: "fill",
            source: "reference",
            layout: { visibility: "none" },
            filter: ["all", ["==", ["get", "kind"], "buffer"], ["==", ["get", "width_m"], p.bufferWidth]],
            paint: { "fill-color": "#ffd54f", "fill-opacity": 0.45 },
          },
          {
            id: "buffer",
            type: "line",
            source: "reference",
            filter: ["all", ["==", ["get", "kind"], "buffer"], ["==", ["get", "width_m"], p.bufferWidth]],
            paint: { "line-color": "#d8f0e0", "line-width": 1.6, "line-dasharray": [2, 1.4] },
          },
          {
            id: "reference",
            type: "line",
            source: "reference",
            filter: ["==", ["get", "kind"], "reference"],
            paint: { "line-color": "#ffffff", "line-width": 1.6 },
          },
          { id: "flags-fill", type: "fill", source: "flags", paint: { "fill-color": FLAG, "fill-opacity": 0.18 } },
          { id: "flags", type: "line", source: "flags", paint: { "line-color": FLAG, "line-width": 2.5 } },
        ],
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 120 }), "bottom-left");
    m.on("load", () => {
      ready.current = true;
      loaded.current = { truecolor: latest.current.imageUrl, overlay: latest.current.overlayUrl, water: latest.current.waterUrl };
      apply(m, latest.current, loaded.current);
      zoom(m, latest.current);
    });
    m.on("error", (e) => {
      const ev = e as unknown as { sourceId?: string; error?: { name?: string; message?: string; status?: number } };
      const src = ev.sourceId;
      if (src !== "truecolor" && src !== "overlay") return;
      // Switching years cancels the previous image: that is not a failure.
      if (ev.error?.name === "AbortError" || /abort/i.test(ev.error?.message ?? "")) return;
      const want = src === "truecolor" ? latest.current.imageUrl : latest.current.overlayUrl;
      // A real failure gets one quiet retry for the year still on screen before we say anything.
      if (retried.current[src] !== want) {
        retried.current[src] = want;
        window.setTimeout(() => {
          const now = src === "truecolor" ? latest.current.imageUrl : latest.current.overlayUrl;
          if (now !== want || !ready.current) return;
          loaded.current[src] = undefined;
          apply(m, latest.current, loaded.current);
        }, 1200);
        return;
      }
      if (src === "truecolor") latest.current.onError?.("This year's photo could not be loaded. Try another year, or reload the page.");
    });
    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
    };
    // The map is created once per lake; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.bounds.join(",")]);

  useEffect(() => {
    if (map.current && ready.current) apply(map.current, p, loaded.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.imageUrl, p.overlayUrl, p.waterUrl, p.layers, p.bufferWidth, p.flags, p.focusFlag, p.zoneFocus]);

  // Turning the zone on: frame the lake and pulse the ring twice so the eye finds it.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current || !p.zoneFocus) return;
    m.fitBounds(p.bounds, { padding: 20, duration: 600 });
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1800);
      m.setPaintProperty("buffer-fill", "fill-opacity", 0.3 + 0.35 * Math.abs(Math.sin(k * Math.PI * 2)));
      if (k < 1) frame = requestAnimationFrame(tick);
      else m.setPaintProperty("buffer-fill", "fill-opacity", 0.45);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.zoneFocus, p.bufferWidth]);

  useEffect(() => {
    if (map.current && ready.current) zoom(map.current, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.zoomTo]);

  return <div ref={el} className="map" />;
}
