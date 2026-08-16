import type { MetadataRoute } from "next";
import { BRAND_COLOR, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { defaultChain as chain } from "@/lib/chain";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} · ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description:
      `Developers publish paid tools in 60 seconds. Autonomous agents discover them and pay per call with x402 on ${chain.name}. No API keys, no accounts.`,
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: BRAND_COLOR,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
