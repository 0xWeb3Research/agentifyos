import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentifyos.xyz"),
  title: {
    default: "AgentifyOS · the marketplace where AI agents shop for tools",
    template: "%s · AgentifyOS",
  },
  description:
    "Developers publish paid tools in 60 seconds. Autonomous agents discover them, pay per call with x402 on Casper. No API keys, no accounts. The payment is the review.",
  openGraph: {
    title: "AgentifyOS",
    description:
      "The marketplace where AI agents discover, pay for, and use tools. Settled with x402 on Casper.",
    url: "https://agentifyos.xyz",
    siteName: "AgentifyOS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentifyOS",
    description:
      "The marketplace where AI agents discover, pay for, and use tools. Settled with x402 on Casper.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
