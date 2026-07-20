import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";
import { DOC_SLUGS } from "@/lib/docs";
import { getToolsWithStats } from "@/lib/data";

// Static routes, ranked by how much we actually want them ranked. /dashboard and
// /publish are excluded: they are account surfaces with nothing to index.
const STATIC: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, freq: "weekly" },
  { path: "/tools", priority: 0.9, freq: "daily" },
  { path: "/explain", priority: 0.8, freq: "monthly" },
  { path: "/docs", priority: 0.8, freq: "weekly" },
  { path: "/developers", priority: 0.7, freq: "monthly" },
  { path: "/agent", priority: 0.6, freq: "monthly" },
  { path: "/roadmap", priority: 0.4, freq: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const tools = getToolsWithStats().map((t) => ({
    url: abs(`/tools/${t.slug}`),
    lastModified: new Date(t.createdAt),
    changeFrequency: "weekly" as const,
    // A verified listing is a stronger result than an unverified one.
    priority: t.status === "verified" ? 0.8 : 0.6,
  }));

  const docs = DOC_SLUGS.map((slug) => ({
    url: abs(`/docs/${slug}`),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    ...STATIC.map((s) => ({
      url: abs(s.path),
      lastModified: now,
      changeFrequency: s.freq,
      priority: s.priority,
    })),
    ...tools,
    ...docs,
  ];
}
