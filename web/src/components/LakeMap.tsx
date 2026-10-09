"use client";

import maplibregl, { type GeoJSONSource, type ImageSource } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { FeatureCollection, FlagProps } from "@/lib/data";

export type Layers = { flags: boolean; outline: boolean; buffer: boolean; landcover: boolean };

type Props = {
  bounds: [number, number, number, number];
  imageUrl: string;
  overlayUrl: string;
  layers: Layers;
  flags: FeatureCollection<FlagProps>;
  reference: FeatureCollection<{ kind: string; width_m?: number }>;
  bufferWidth: number;
  focusFlag?: string | null;
  zoomTo?: string | null; // fly to this flag; null = whole lake
  onError?: (message: string) => void;
};

const corners = ([w, s, e, n]: Props["bounds"]) =>
  [[w, n], [e, n], [e, s], [w, s]] as [[number, number], [number, number], [number, number], [number, number]];
const FLAG = "#f5a524";

function apply(m: maplibregl.Map, p: Props) {
  (m.getSource("truecolor") as ImageSource | undefined)?.updateImage({ url: p.imageUrl, coordinates: corners(p.bounds) });
  (m.getSource("overlay") as ImageSource | undefined)?.updateImage({ url: p.overlayUrl, coordinates: corners(p.bounds) });
  const vis = (on: boolean) => (on ? "visible" : "none");
  m.setLayoutProperty("overlay", "visibility", vis(p.layers.landcover));
  m.setLayoutProperty("reference", "visibility", vis(p.layers.outline));
  m.setLayoutProperty("buffer", "visibility", vis(p.layers.buffer));
  m.setLayoutProperty("flags-fill", "visibility", vis(p.layers.flags));
  m.setLayoutProperty("flags", "visibility", vis(p.layers.flags));
  m.setFilter("buffer", ["all", ["==", ["get", "kind"], "buffer"], ["==", ["get", "width_m"], p.bufferWidth]]);
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
          flags: { type: "geojson", data: p.flags as GeoJSON.FeatureCollection },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.7 } },
          { id: "truecolor", type: "raster", source: "truecolor", paint: { "raster-resampling": "nearest" } },
          { id: "overlay", type: "raster", source: "overlay", paint: { "raster-resampling": "nearest", "raster-opacity": 0.8 } },
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
      apply(m, latest.current);
      zoom(m, latest.current);
    });
    m.on("error", (e) => {
      const src = (e as unknown as { sourceId?: string }).sourceId;
      if (src === "truecolor" || src === "overlay") latest.current.onError?.("This season's image could not be loaded.");
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
    if (map.current && ready.current) apply(map.current, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.imageUrl, p.overlayUrl, p.layers, p.bufferWidth, p.flags, p.focusFlag]);

  useEffect(() => {
    if (map.current && ready.current) zoom(map.current, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.zoomTo]);

  return <div ref={el} className="map" />;
}
