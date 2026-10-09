"use client";

import maplibregl, { type ImageSource, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { FeatureCollection, FlagProps } from "@/lib/data";

type Props = {
  bounds: [number, number, number, number];
  imageUrl: string;
  overlayUrl: string;
  showOverlay: boolean;
  flags: FeatureCollection<FlagProps>;
  reference: FeatureCollection<{ kind: string; width_m?: number }>;
  bufferWidth: number;
  focusFlag?: string | null;
};

const corners = ([w, s, e, n]: Props["bounds"]) =>
  [[w, n], [e, n], [e, s], [w, s]] as [[number, number], [number, number], [number, number], [number, number]];

export default function LakeMap(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);

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
            attribution: "© OpenStreetMap contributors",
          },
          truecolor: { type: "image", url: p.imageUrl, coordinates: corners(p.bounds) },
          overlay: { type: "image", url: p.overlayUrl, coordinates: corners(p.bounds) },
          reference: { type: "geojson", data: p.reference as GeoJSON.FeatureCollection },
          flags: { type: "geojson", data: p.flags as GeoJSON.FeatureCollection },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.6 } },
          { id: "truecolor", type: "raster", source: "truecolor", paint: { "raster-resampling": "nearest" } },
          {
            id: "overlay",
            type: "raster",
            source: "overlay",
            paint: { "raster-resampling": "nearest", "raster-opacity": 0.85 },
          },
          {
            id: "buffer",
            type: "line",
            source: "reference",
            filter: ["all", ["==", ["get", "kind"], "buffer"], ["==", ["get", "width_m"], p.bufferWidth]],
            paint: { "line-color": "#f2c200", "line-width": 2, "line-dasharray": [2, 1] },
          },
          {
            id: "reference",
            type: "line",
            source: "reference",
            filter: ["==", ["get", "kind"], "reference"],
            paint: { "line-color": "#ffffff", "line-width": 1.5 },
          },
          {
            id: "flags",
            type: "line",
            source: "flags",
            paint: { "line-color": "#ff3b1f", "line-width": ["case", ["==", ["get", "flag_id"], ""], 4, 2.5] },
          },
        ],
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => (ready.current = true));
    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
    };
    // The map is created once per lake; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.bounds.join(",")]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      (m.getSource("truecolor") as ImageSource | undefined)?.updateImage({ url: p.imageUrl, coordinates: corners(p.bounds) });
      (m.getSource("overlay") as ImageSource | undefined)?.updateImage({ url: p.overlayUrl, coordinates: corners(p.bounds) });
      m.setLayoutProperty("overlay", "visibility", p.showOverlay ? "visible" : "none");
      m.setFilter("buffer", ["all", ["==", ["get", "kind"], "buffer"], ["==", ["get", "width_m"], p.bufferWidth]]);
      (m.getSource("flags") as GeoJSONSource | undefined)?.setData(p.flags as GeoJSON.FeatureCollection);
      m.setPaintProperty("flags", "line-width", ["case", ["==", ["get", "flag_id"], p.focusFlag ?? ""], 4, 2.5]);
    };
    if (ready.current) apply();
    else m.once("load", apply);
  }, [p.imageUrl, p.overlayUrl, p.showOverlay, p.bufferWidth, p.flags, p.focusFlag, p.bounds]);

  return <div ref={el} className="map" />;
}
