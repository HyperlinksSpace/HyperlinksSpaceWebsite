"use client";

import { useLanguage } from "./LanguageContext";
import ExternalLink from "./ExternalLink";
import { SITE_LINKS } from "../siteLinks";

export default function StrategyOverlay() {
  const { language } = useLanguage();

  return (
    <ExternalLink
      href={SITE_LINKS.overlays.strategy.href}
      ariaLabel={SITE_LINKS.overlays.strategy.ariaLabel}
      className="siteStrategyOverlay"
    >
      <img
        src={
          language === "ru" 
            ? "/hyperlinks/Assets/Ctrategy_ru.svg" 
            : "/hyperlinks/Assets/Ctrategy.svg"
        }
        alt=""
        width={430}
        height={208}
      />
    </ExternalLink>
  );
}
