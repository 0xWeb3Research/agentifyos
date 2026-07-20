import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { SITE_URL, SITE_NAME, abs } from "@/lib/site";
import "./globals.css";

const DESCRIPTION =
  "Developers publish paid tools in 60 seconds. Autonomous agents discover them, pay per call with x402 on Casper. No API keys, no accounts. The payment is the review.";
const SHORT_DESCRIPTION =
  "The marketplace where AI agents discover, pay for, and use tools. Settled with x402 on Casper.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AgentifyOS · the marketplace where AI agents shop for tools",
    template: "%s · AgentifyOS",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  category: "technology",
  keywords: [
    "x402",
    "AI agent payments",
    "Casper Network",
    "agentic commerce",
    "pay per call API",
    "MCP server",
    "machine payable web",
    "HTTP 402",
    "WCSPR",
    "agent tool marketplace",
  ],
  // Deliberately NO `alternates.canonical` here. Child segments inherit it, so a
  // page that forgets its own would self-canonicalise to "/" and be dropped from
  // the index as a duplicate. The home page sets its own; a missing canonical is
  // harmless, a wrong one is not.
  openGraph: {
    title: SITE_NAME,
    description: SHORT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SHORT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    // Without max-image-preview:large, Google renders a thumbnail instead of the
    // full OG card. It is the single highest-leverage robots directive for previews.
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#fafafa" },
  ],
  colorScheme: "light",
};

// Site-wide graph: who publishes this, and what the site is. Page-level schemas
// (SoftwareApplication, TechArticle) reference these by @id rather than
// restating them.
const siteGraph = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: abs("/icon-512.png"), width: 512, height: 512 },
    description: SHORT_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: abs("/tools?q={search_term_string}") },
      "query-input": "required name=search_term_string",
    },
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <JsonLd data={siteGraph} />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
