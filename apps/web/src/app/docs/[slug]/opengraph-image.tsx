import { notFound } from "next/navigation";
import { OG_SIZE, renderOgCard } from "@/lib/og-card";
import { getDoc, DOC_SLUGS } from "@/lib/docs";

export const alt = "AgentifyOS documentation";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";

export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export default async function DocOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const doc = await getDoc((await params).slug);
  // Unknown slugs 404 like the sibling page route. Rendering a card here would
  // let arbitrary slugs trigger an uncached satori+resvg pass (and a fresh cache
  // entry) per URL: cheap requests amplified into unbounded server CPU.
  if (!doc) notFound();
  return renderOgCard({
    title: doc.meta.title,
    subtitle: doc.meta.summary,
    badge: "Docs",
    footnote: `${doc.meta.minutes} min read · agentifyos.xyz`,
  });
}
