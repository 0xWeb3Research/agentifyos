// One source of truth for the public origin. Absolute URLs appear in the
// sitemap, robots.txt, canonicals, and JSON-LD, and a wrong origin in any of
// them is worse than none at all — so derive it rather than hardcoding.
//
// Railway injects RAILWAY_PUBLIC_DOMAIN at runtime, which lets a preview
// deployment advertise itself instead of claiming to be the production domain.
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railway) return `https://${railway.replace(/\/$/, "")}`;
  return "https://agentifyos.xyz";
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "AgentifyOS";
export const SITE_TAGLINE = "The marketplace where AI agents shop for tools.";
export const BRAND_COLOR = "#f82636";

/** Absolute URL for a site-relative path. */
export function abs(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
