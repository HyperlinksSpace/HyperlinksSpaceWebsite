"use client";

import type { MouseEvent, ReactNode } from "react";

export default function ExternalLink({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const openInNewWindow = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className={className}
      onClick={openInNewWindow}
    >
      {children}
    </a>
  );
}
