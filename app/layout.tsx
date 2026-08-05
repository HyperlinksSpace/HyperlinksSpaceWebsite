import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import ViewportFix from "./components/ViewportFix";
import DeferredEffects from "./components/DeferredEffects";
import ExternalLink from "./components/ExternalLink";
import LanguageSwitcher from "./components/LanguageSwitcher";
import ThemeSwitcher from "./components/ThemeSwitcher";
import SiteSettings from "./components/SiteSettings";
import LogoOverlay from "./components/LogoOverlay";
import StrategyOverlay from "./components/StrategyOverlay";
import { LanguageProvider } from "./components/LanguageContext";
import { ThemeProvider } from "./components/ThemeContext";
import { BlackHoleProvider } from "./components/BlackHoleContext";
import { getStickerLinks, SITE_LINKS } from "./siteLinks";
import "./globals.css";

const themeInitScript = `(function(){try{var k='hyperlinks-theme';var t=localStorage.getItem(k);var r=t==='light'?'light':'dark';var p=(t==='light'||t==='dark')?t:'dark';document.documentElement.setAttribute('data-theme',r);document.documentElement.setAttribute('data-theme-pref',p);}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-theme-pref','dark');}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hyperlinks.Space",
  description: "Hyperlinks.Space",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/** Top logo (HyperlinksSpace): max px cap + max vw cap */
const SITE_LOGO_SIZE = {
  topPx: 12,
  maxWidthPx: 160,
  maxViewportWidthPercent: 36,
} as const;

/**
 * Side wordmarks stay in opposite corners and never cross mid-screen.
 * Width is capped by CSS with vw/vh so they remain readable but non-overlapping.
 */
const SITE_STRATEGY_SIZE = {
  leftPx: 10,
  maxWidthPx: 560,
} as const;

const SITE_AITYAAHN_SIZE = {
  rightPx: 12,
  maxWidthPx: 480,
} as const;

/** Bottom ad banner: edit these to change size/position (see `.siteAdOverlay*` in globals.css). */
const SITE_AD_SIZE = {
  bottomPx: 16,
  maxWidthPx: 360,
  maxViewportWidthPercent: 62,
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stickerLinks = getStickerLinks();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {[1, 2, 3, 4].map((n) => (
          <link
            key={n}
            rel="preload"
            href={`/hyperlinks/${n}.svg`}
            as="fetch"
            crossOrigin="anonymous"
          />
        ))}
        {["4iza", "maska", "walley"].map((name) => (
          <link
            key={name}
            rel="preload"
            href={`/hyperlinks/Stikars/${name}.svg`}
            as="image"
          />
        ))}
      </head>
      <body
        className={`${geistSans.variable} antialiased`}
      >
        <LanguageProvider>
          <ThemeProvider>
          <BlackHoleProvider>
          <ViewportFix />
          <DeferredEffects links={stickerLinks} />
          {/* Bouncing stickers + cursor effects (deferred) */}
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
              <LogoOverlay />
            </Link>
          </div>
          {/* Left-center strategy wordmark */}
          <div
            className="siteStrategyOverlayWrapper"
            style={
              {
                "--site-strategy-left": `${SITE_STRATEGY_SIZE.leftPx}px`,
                "--site-strategy-max-width": `${SITE_STRATEGY_SIZE.maxWidthPx}px`,
              } as CSSProperties
            }
          >
            <StrategyOverlay />
          </div>
        {/* Right-side AityAahn wordmark, slightly below vertical center */}
        <div
          className="siteAityaahnOverlayWrapper"
          style={
            {
              "--site-aityaahn-right": `${SITE_AITYAAHN_SIZE.rightPx}px`,
              "--site-aityaahn-max-width": `${SITE_AITYAAHN_SIZE.maxWidthPx}px`,
            } as CSSProperties
          }
        >
          <ExternalLink
            href={SITE_LINKS.overlays.aityUahn.href}
            ariaLabel={SITE_LINKS.overlays.aityUahn.ariaLabel}
            className="siteAityaahnOverlay"
          >
            <img
              src="/hyperlinks/Assets/AityAahn.svg"
              alt=""
              width={317}
              height={160}
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
          <ExternalLink
            href={SITE_LINKS.overlays.program.href}
            ariaLabel={SITE_LINKS.overlays.program.ariaLabel}
            className="siteAdOverlay"
          >
            <img
              src="/hyperlinks/Assets/ad.svg"
              alt=""
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </ExternalLink>
        </div>
          <SiteSettings />
          <ThemeSwitcher />
          <LanguageSwitcher />
          {children}
          <Analytics />
          </BlackHoleProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
