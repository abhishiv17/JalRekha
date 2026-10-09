import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JalRekha",
    short_name: "JalRekha",
    description: "See how our lakes change over time: satellite evidence of change in lake beds and buffer zones.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#1f5c3f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
