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
  if (!doc) return renderOgCard();
  return renderOgCard({
    title: doc.meta.title,
    subtitle: doc.meta.summary,
    badge: "Docs",
    footnote: `${doc.meta.minutes} min read · agentifyos.xyz`,
  });
}
