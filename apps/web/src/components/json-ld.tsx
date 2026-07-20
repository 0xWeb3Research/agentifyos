// Structured data. Search engines and AI crawlers both read this; it is the
// difference between being indexed as "a page" and being indexed as "a tool you
// can buy for $0.002 per call".
//
// Rendered as a plain script tag rather than via next/script so it is present in
// the server-rendered HTML, which is all a crawler ever sees.
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // The payload is built from our own data, never from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
