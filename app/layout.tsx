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
        <div className="siteLogoOverlayWrapper">
          <Link href="/" aria-label="Reload" className="siteLogoOverlay">
            <img
              src="/hyperlinks/Assets/HyperlinksSpace.svg"
              alt=""
              width={100}
              height={100}
              style={{ display: "block", width: "100px", height: "100px" }}
            />
          </Link>
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
