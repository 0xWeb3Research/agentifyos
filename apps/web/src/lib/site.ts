// One source of truth for the public origin. Absolute URLs appear in the
// sitemap, robots.txt, canonicals, and JSON-LD, and a wrong origin in any of
// them is worse than none at all, so derive it rather than hardcoding.
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

/**
 * The URL a client actually asked for, as opposed to the one this process was
 * handed.
 *
 * Behind Railway's proxy `req.url` is the internal address the container is
 * listening on (`https://localhost:8080/...`). That is fine for reading a path,
 * and wrong for anything a client will read back and check. An x402 challenge
 * is exactly that: the resource url is part of what a payment is minted for, so
 * quoting the internal host produces a payment for a resource that does not
 * exist at an address nobody can reach.
 *
 * Same rule as `authOrigin`: a deployment that has been told its own origin is
 * believed over any header, since a forwarded host is attacker-controlled. Only
 * genuine local dev, or a deployment with no origin configured, falls back to
 * the request.
 */
export function publicRequestUrl(req: Request): string {
  const url = new URL(req.url);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.RAILWAY_PUBLIC_DOMAIN,
  );
  if (configured && process.env.NODE_ENV !== "development") {
    return `${new URL(SITE_URL).origin}${url.pathname}${url.search}`;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}${url.pathname}${url.search}`;
}
