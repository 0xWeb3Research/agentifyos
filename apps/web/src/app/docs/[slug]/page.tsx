import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { Container, Eyebrow, Arrow } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { getDoc, listDocs, DOC_SLUGS } from "@/lib/docs";

export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const doc = await getDoc((await params).slug);
  if (!doc) return { title: "Not found" };
  return { title: doc.meta.title, description: doc.meta.summary };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) notFound();

  const all = await listDocs();
  const index = all.findIndex((d) => d.slug === slug);
  const prev = index > 0 ? all[index - 1] : null;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null;

  return (
    <main>
      <Container className="pb-16 pt-12">
        <div className="flex min-w-0 flex-col gap-10 lg:flex-row lg:gap-12">
          {/* contents rail — becomes a plain list above lg */}
          <aside className="min-w-0 shrink-0 lg:w-[210px]">
            <div className="lg:sticky lg:top-20">
              <Link
                href="/docs"
                className="press label inline-flex items-center gap-1.5 text-muted transition-colors hover:text-fg"
              >
                ← all docs
              </Link>
              <nav className="mt-4 flex flex-col gap-0.5">
                {all.map((d) => (
                  <Link
                    key={d.slug}
                    href={`/docs/${d.slug}`}
                    className={clsx(
                      "press truncate rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13.5px] transition-colors",
                      d.slug === slug
                        ? "bg-tint font-medium text-fg"
                        : "text-fg-secondary hover:text-fg",
                    )}
                  >
                    {d.title}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <article className="min-w-0 max-w-[74ch] flex-1">
            <Eyebrow>{doc.meta.minutes} min read</Eyebrow>
            <h1 className="mt-3 text-[32px] font-medium leading-[1.1] tracking-[-0.03em] sm:text-[38px]">
              {doc.meta.title}
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-secondary">
              {doc.meta.summary}
            </p>
            <hr className="my-8 border-border" />

            <Markdown>{doc.body}</Markdown>

            <nav className="mt-14 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
              {prev ? (
                <Link
                  href={`/docs/${prev.slug}`}
                  className="press min-w-0 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 transition-colors hover:border-border-hover"
                >
                  <span className="label text-muted">previous</span>
                  <span className="mt-1 block truncate text-[14px] font-medium">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={`/docs/${next.slug}`}
                  className="press group min-w-0 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-right transition-colors hover:border-border-hover sm:col-start-2"
                >
                  <span className="label text-muted">next</span>
                  <span className="mt-1 flex items-center justify-end gap-1.5 truncate text-[14px] font-medium">
                    {next.title}
                    <Arrow className="text-muted group-hover:translate-x-0.5 group-hover:text-fg" />
                  </span>
                </Link>
              )}
            </nav>
          </article>
        </div>
      </Container>
    </main>
  );
}
