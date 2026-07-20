import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_COLOR, SITE_TAGLINE } from "@/lib/site";

// The shared link-preview card, used by the Open Graph, Twitter, and per-tool
// routes. It lives outside app/ because Next requires each route file to declare
// its own `runtime` literally — those exports cannot be re-exported from a sibling.
export const OG_ALT = "AgentifyOS — the marketplace where AI agents shop for tools";
export const OG_SIZE = { width: 1200, height: 630 };

const geist = (weight: "Regular" | "Medium") =>
  path.join(
    process.cwd(),
    "node_modules/geist/dist/fonts/geist-sans",
    `Geist-${weight}.ttf`,
  );

export interface OgCardOptions {
  /** Headline. Defaults to the site tagline. */
  title?: string;
  /** Supporting line under the headline. */
  subtitle?: string;
  /** Pill in the bottom-left. */
  badge?: string;
  /** Small line to the right of the badge. Defaults to the domain. */
  footnote?: string;
}

export async function renderOgCard(opts: OgCardOptions = {}) {
  const {
    title = SITE_TAGLINE,
    subtitle = "Publish a paid tool in 60 seconds. Agents discover it and pay per call with x402 — no API keys, no accounts.",
    badge = "x402 on Casper",
    footnote = "agentifyos.xyz",
  } = opts;

  const [logo, regular, medium] = await Promise.all([
    readFile(path.join(process.cwd(), "public/logo.png")),
    readFile(geist("Regular")),
    readFile(geist("Medium")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  // Long tool names would otherwise overflow the card, so step the headline down
  // rather than letting it clip.
  const titleSize = title.length > 64 ? 52 : title.length > 40 ? 60 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafafa",
          padding: "72px 80px",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={104} height={104} alt="" />
          <span
            style={{ fontSize: 52, fontWeight: 500, letterSpacing: "-0.03em", color: "#0a0a0a" }}
          >
            AgentifyOS
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span
            style={{
              fontSize: titleSize,
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.035em",
              color: "#0a0a0a",
              maxWidth: 940,
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 28, lineHeight: 1.4, color: "#666666", maxWidth: 860 }}>
            {subtitle}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 22 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              background: BRAND_COLOR,
              color: "#ffffff",
              borderRadius: 999,
              padding: "8px 20px",
              letterSpacing: "0.02em",
            }}
          >
            {badge}
          </span>
          <span style={{ color: "#999999" }}>{footnote}</span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
