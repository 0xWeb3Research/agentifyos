import { OG_ALT, OG_SIZE, renderOgCard } from "@/lib/og-card";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";

export default function OpengraphImage() {
  return renderOgCard();
}
