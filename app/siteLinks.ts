/** Single source of truth for all outbound URLs on the site. */
export const SITE_LINKS = {
  /** Main 2×2 grid cells (links 1–4). */
  grid: [
    "https://www.techsymbal.com/",
    "https://t.me/what_swap_bot/whatswap?mode=compact",
    "https://aaa.band/",
    "https://www.desde.io/",
  ],
  overlays: {
    strategy: {
      href: "https://ctrategy.hyperlinks.space/",
      ariaLabel: "Open Hyperlinks Space Strategy",
    },
    aityUahn: {
      href: "https://aityuahn.hyperlinks.space/",
      ariaLabel: "Open AityUahn",
    },
    program: {
      href: "https://landing.program.hyperlinks.space/",
      ariaLabel: "Launch Hyperlinks Space Program",
    },
  },
} as const;

/** Pool used by bouncing stickers (grid links + program landing). */
export function getStickerLinks(): string[] {
  return [...SITE_LINKS.grid, SITE_LINKS.overlays.program.href];
}
