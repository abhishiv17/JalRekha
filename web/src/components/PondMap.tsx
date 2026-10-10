"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

import { POND_COLOUR, type Pond, type PondStatus } from "@/lib/ponds";

export { POND_COLOUR };
export type { Pond, PondStatus };

type Props = {
  ponds: Pond[];
  bbox: [number, number, number, number];
  show: Partial<Record<PondStatus, boolean>>;
  selected: string | null;
  onSelect: (id: string) => void;
};

// Points stay visible when zoomed out (most ponds are a few pixels across at city zoom);
// outlines take over when zoomed in.
function points(ponds: Pond[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: ponds.map((p) => ({
      type: "Feature",
      properties: { id: p.properties.id, status: p.properties.status, ha: p.properties.area_ha },
      geometry: { type: "Point", coordinates: [p.properties.lon, p.properties.lat] },
    })),
  };
}

const COLOUR: maplibregl.ExpressionSpecification = [
  "match", ["get", "status"], "vanished", POND_COLOUR.vanished, "shrank", POND_COLOUR.shrank,
  "came_back", POND_COLOUR.came_back, POND_COLOUR.alive,
];

export default function PondMap(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    if (!el.current) return;
    const [w, s, e, n] = p.bbox;
    const m = new maplibregl.Map({
      container: el.current,
      bounds: [[w, s], [e, n]],
      fitBoundsOptions: { padding: 12 },
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
          shapes: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          points: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.7 } },
          { id: "shape-fill", type: "fill", source: "shapes", minzoom: 13, paint: { "fill-color": COLOUR, "fill-opacity": 0.35 } },
          { id: "shape-line", type: "line", source: "shapes", minzoom: 13, paint: { "line-color": COLOUR, "line-width": 1.5 } },
          {
            id: "dots", type: "circle", source: "points",
            paint: {
              "circle-color": COLOUR,
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, ["case", ["==", ["get", "status"], "alive"], 3, 5], 14, 9],
              "circle-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.9, 15, 0.25],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": ["case", ["==", ["get", "status"], "alive"], 0, 1],
            },
          },
          {
            id: "picked", type: "circle", source: "points", filter: ["==", ["get", "id"], ""],
            paint: { "circle-radius": 12, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#111", "circle-stroke-width": 2.5 },
          },
        ],
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 120 }), "bottom-left");
    m.on("load", () => {
      ready.current = true;
      draw(m, latest.current);
    });
    for (const layer of ["dots", "shape-fill"]) {
      m.on("click", layer, (ev) => {
        const id = ev.features?.[0]?.properties?.id;
        if (id) latest.current.onSelect(String(id));
      });
      m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
    }
    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
    };
    // Created once; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map.current && ready.current) draw(map.current, p);
  }, [p.ponds, p.show]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    m.setFilter("picked", ["==", ["get", "id"], p.selected ?? ""]);
    const pond = p.ponds.find((x) => x.properties.id === p.selected);
    if (pond) m.flyTo({ center: [pond.properties.lon, pond.properties.lat], zoom: Math.max(m.getZoom(), 15.5), duration: 800 });
  }, [p.selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="map pond-map" />;
}

function draw(m: maplibregl.Map, p: Props) {
  const shown = p.ponds.filter((x) => p.show[x.properties.status]);
  (m.getSource("shapes") as maplibregl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: shown } as GeoJSON.FeatureCollection);
  (m.getSource("points") as maplibregl.GeoJSONSource | undefined)?.setData(points(shown));
}
