import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// The shared link-preview card, used by both the Open Graph and Twitter routes.
// It lives outside app/ because Next requires each route file to declare its own
// `runtime` literally — those exports cannot be re-exported from a sibling.
export const OG_ALT = "AgentifyOS — the marketplace where AI agents shop for tools";
export const OG_SIZE = { width: 1200, height: 630 };

const geist = (weight: "Regular" | "Medium") =>
  path.join(
    process.cwd(),
    "node_modules/geist/dist/fonts/geist-sans",
    `Geist-${weight}.ttf`,
  );

export async function renderOgCard() {
  const [logo, regular, medium] = await Promise.all([
    readFile(path.join(process.cwd(), "public/logo.png")),
    readFile(geist("Regular")),
    readFile(geist("Medium")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

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
              fontSize: 64,
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.035em",
              color: "#0a0a0a",
              maxWidth: 900,
            }}
          >
            The marketplace where AI agents shop for tools.
          </span>
          <span style={{ fontSize: 28, lineHeight: 1.4, color: "#666666", maxWidth: 820 }}>
            Publish a paid tool in 60 seconds. Agents discover it and pay per call
            with x402 — no API keys, no accounts.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 22 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              background: "#f82636",
              color: "#ffffff",
              borderRadius: 999,
              padding: "8px 20px",
              letterSpacing: "0.02em",
            }}
          >
            x402 on Casper
          </span>
          <span style={{ color: "#999999" }}>agentifyos.xyz</span>
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
