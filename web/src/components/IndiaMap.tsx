"use client";

import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { type Card, cardHref, placeLabel, statusOf } from "@/lib/catalog";

const INDIA: [[number, number], [number, number]] = [[68, 6.5], [97.5, 35.8]];

function show(m: maplibregl.Map, data: GeoJSON.FeatureCollection) {
  (m.getSource("lakes") as GeoJSONSource | undefined)?.setData(data);
  const pts = data.features.map((f) => (f.geometry as GeoJSON.Point).coordinates);
  if (!pts.length) return;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const box: [[number, number], [number, number]] = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
  m.fitBounds(box, { padding: 40, maxZoom: 11, duration: 600 });
}

/** Every listed lake as a dot; follows the page's filters, click opens the lake. */
export default function IndiaMap({ lakes }: { lakes: Card[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const router = useRouter();
  const latest = useRef<GeoJSON.FeatureCollection | null>(null);

  const data = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: lakes
      .filter((c) => c.lat != null && c.lon != null)
      .map((c) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lon!, c.lat!] },
        properties: {
          href: cardHref(c),
          name: c.name,
          place: placeLabel(c),
          status: statusOf(c).label,
          tone: statusOf(c).tone,
          ac: c.areaAc ?? 0,
        },
      })),
  }), [lakes]);

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      bounds: INDIA,
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors",
          },
          lakes: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "base", type: "raster", source: "base", paint: { "raster-saturation": -0.85, "raster-brightness-min": 0.08, "raster-contrast": -0.15 } },
          {
            id: "queued",
            type: "circle",
            source: "lakes",
            filter: ["==", ["get", "tone"], "queued"],
            paint: {
              "circle-color": "#2f6fd6",
              "circle-opacity": 0.6,
              // Small dots across India, larger ones as you zoom into a state; area sets the size.
              "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                4, ["interpolate", ["linear"], ["sqrt", ["get", "ac"]], 0, 1.2, 30, 2.5, 150, 5],
                9, ["interpolate", ["linear"], ["sqrt", ["get", "ac"]], 0, 3, 30, 7, 150, 14],
              ],
              "circle-stroke-width": 0.5,
              "circle-stroke-color": "#ffffff",
            },
          },
          {
            id: "analysed",
            type: "circle",
            source: "lakes",
            filter: ["!=", ["get", "tone"], "queued"],
            paint: {
              "circle-color": ["match", ["get", "tone"], "changed", "#e2542a", "#1e6b3a"],
              "circle-radius": 7,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          },
        ],
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    for (const layer of ["queued", "analysed"]) {
      m.on("mouseenter", layer, (e) => {
        m.getCanvas().style.cursor = "pointer";
        const p = e.features?.[0]?.properties;
        if (!p) return;
        const box = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = p.name;
        const meta = document.createElement("div");
        meta.textContent = `${p.place} · ${p.status}`;
        box.append(name, meta);
        popup.setLngLat(e.lngLat).setDOMContent(box).addTo(m);
      });
      m.on("mouseleave", layer, () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("click", layer, (e) => {
        const href = e.features?.[0]?.properties?.href;
        if (href) router.push(href);
      });
    }
    m.on("load", () => {
      ready.current = true;
      if (latest.current) show(m, latest.current); // data that arrived before the map was ready
    });
    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
    };
  }, [router]);

  useEffect(() => {
    latest.current = data;
    if (map.current && ready.current) show(map.current, data);
  }, [data]);

  return (
    <div>
      <div ref={el} className="map india-map" />
      <div className="legend">
        <span><i style={{ background: "#e2542a", borderRadius: 99 }} />Analysed, change found</span>
        <span><i style={{ background: "#1e6b3a", borderRadius: 99 }} />Analysed, no lasting change</span>
        <span><i style={{ background: "#2f6fd6", opacity: 0.6, borderRadius: 99 }} />Queued (size = lake area)</span>
      </div>
    </div>
  );
}
