import { OG_ALT, OG_SIZE, renderOgCard } from "@/lib/og-card";

// Twitter reads its own file convention, so it reuses the same card rather than
// maintaining a second near-identical layout.
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";

export default function TwitterImage() {
  return renderOgCard();
}
