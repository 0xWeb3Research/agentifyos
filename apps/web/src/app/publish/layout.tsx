import type { Metadata } from "next";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Publish a tool",
  description:
    "Turn one manifest into a catalog listing, a discovery record, and an MCP tool, priced per call and settled in USDC on Algorand.",
  alternates: { canonical: "/publish" },
  // An authenticated action surface (not a page worth ranking), but its links
  // into the catalog are still worth following.
  robots: { index: false, follow: true },
};

export default function PublishLayout({ children }: { children: React.ReactNode }) {
  return children;
}
