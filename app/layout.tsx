import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import ViewportFix from "./components/ViewportFix";
import CursorSmudge from "./components/CursorSmudge";
import BouncingStickers from "./components/BouncingStickers";
import ExternalLink from "./components/ExternalLink";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hyperlinks.Space",
  description: "Hyperlinks.Space",
  icons: {
    icon: "/favicon.ico?v=2",
    shortcut: "/favicon.ico?v=2",
    apple: "/favicon.ico?v=2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/** Top logo (HyperlinksSpace): max px cap + max vw cap (see `.siteLogoOverlay` in globals.css) */
const SITE_LOGO_SIZE = {
  topPx: 20,
  maxWidthPx: 100,
  maxViewportWidthPercent: 30,
} as const;

/**
 * Ctrategy wordmark: same min(px, vw) pattern as SITE_LOGO_SIZE.
 * Desktop px cap is set high — thin strokes read smaller than the square logo at equal width.
 */
const SITE_STRATEGY_SIZE = {
  maxWidthPx: 440,
  maxViewportWidthPercent: 52,
} as const;

/** Bottom ad banner: edit these to change size/position (see `.siteAdOverlay*` in globals.css). */
const SITE_AD_SIZE = {
  bottomPx: 20,
  maxWidthPx: 481,
  maxViewportWidthPercent: 77,
} as const;

function parseLinksFile(contents: string): string[] {
  return contents
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+\.\s*/, "").trim());
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let stickerLinks: string[] = ["/", "/", "/", "/", "https://landing.program.hyperlinks.space/"];
  try {
    const linksPath = path.join(process.cwd(), "public", "hyperlinks", "links.txt");
    const linksTxt = await readFile(linksPath, "utf8");
    const fromFile = parseLinksFile(linksTxt);
    stickerLinks = [...fromFile.slice(0, 4), "https://landing.program.hyperlinks.space/"];
  } catch {
    // use defaults
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ViewportFix />
        <CursorSmudge />
        {/* Fixed overlay logo, independent from all background scaling */}
        <div
          className="siteLogoOverlayWrapper"
          style={
            {
              "--site-logo-top": `${SITE_LOGO_SIZE.topPx}px`,
              "--site-logo-max-width": `${SITE_LOGO_SIZE.maxWidthPx}px`,
              "--site-logo-max-vw": `${SITE_LOGO_SIZE.maxViewportWidthPercent}vw`,
            } as CSSProperties
          }
        >
          <Link href="/" aria-label="Reload" className="siteLogoOverlay">
            <img
              src="/hyperlinks/Assets/HyperlinksSpace.svg"
              alt=""
              width={100}
              height={100}
            />
          </Link>
        </div>
        {/* Left-center strategy wordmark */}
        <div
          className="siteStrategyOverlayWrapper"
          style={
            {
              "--site-strategy-max-width": `${SITE_STRATEGY_SIZE.maxWidthPx}px`,
              "--site-strategy-max-vw": `${SITE_STRATEGY_SIZE.maxViewportWidthPercent}vw`,
            } as CSSProperties
          }
        >
          <ExternalLink
            href="https://ctrategy.hyperlinks.space/"
            ariaLabel="Open Hyperlinks Space Strategy"
            className="siteStrategyOverlay"
          >
            <img
              src="/hyperlinks/Assets/Ctrategy.svg"
              alt=""
              width={430}
              height={208}
            />
          </ExternalLink>
        </div>
        {/* Bottom ad: image from public/hyperlinks/Assets/ad.svg */}
        <div
          className="siteAdOverlayWrapper"
          style={
            {
              "--site-ad-bottom": `${SITE_AD_SIZE.bottomPx}px`,
              "--site-ad-max-width": `${SITE_AD_SIZE.maxWidthPx}px`,
              "--site-ad-max-vw": `${SITE_AD_SIZE.maxViewportWidthPercent}vw`,
            } as CSSProperties
          }
        >
          <a
            href="https://landing.program.hyperlinks.space/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Launch Hyperlinks Space Program"
            className="siteAdOverlay"
          >
            <img
              src="/hyperlinks/Assets/ad.svg"
              alt=""
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </a>
        </div>
        {/* Bouncing stickers on top of everything */}
        <BouncingStickers links={stickerLinks} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
