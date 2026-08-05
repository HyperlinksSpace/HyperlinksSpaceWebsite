"use client";

import { useEffect, useRef } from "react";

interface WaveSVGProps {
  svgSrc: string;
  /** 1 ink · 2 blue · 3 red · 4 gray */
  tone?: 1 | 2 | 3 | 4;
}

const TONE_CLASS: Record<number, string> = {
  1: "waveToneInk",
  2: "waveToneBlue",
  3: "waveToneRed",
  4: "waveToneGray",
};

const FILL_TO_VAR: Record<string, string> = {
  black: "var(--cloud-ink)",
  "#000000": "var(--cloud-ink)",
  "#0a0c0b": "var(--cloud-ink)",
  "#0b1210": "var(--cloud-ink)",
  "#0000ff": "var(--cloud-blue)",
  "#2b5cff": "var(--cloud-blue)",
  "#2a6bff": "var(--cloud-blue)",
  "#3568ff": "var(--cloud-blue)",
  "#f12323": "var(--cloud-red)",
  "#ff2d35": "var(--cloud-red)",
  "#ff4050": "var(--cloud-red)",
  "#818181": "var(--cloud-gray)",
  "#8e959e": "var(--cloud-gray)",
  "#8a939e": "var(--cloud-gray)",
};

function retuneFills(root: Element) {
  root.querySelectorAll("[fill]").forEach((el) => {
    const fill = el.getAttribute("fill");
    if (!fill || fill === "none") return;
    const mapped = FILL_TO_VAR[fill] ?? FILL_TO_VAR[fill.toLowerCase()];
    if (mapped) el.setAttribute("fill", mapped);
  });
}

export default function WaveSVG({ svgSrc, tone }: WaveSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    fetch(svgSrc)
      .then((r) => r.text())
      .then((svgContent) => {
        if (cancelled || !containerRef.current) return;

        const doc = new DOMParser().parseFromString(svgContent, "image/svg+xml");
        const svgElement = doc.querySelector("svg");
        if (!svgElement) return;

        const svg = svgElement.cloneNode(true) as SVGSVGElement;
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.classList.add("hyperlinksWaveSvg");
        if (tone) svg.classList.add(TONE_CLASS[tone]);

        retuneFills(svg);

        // Force theme fill via CSS currentColor path for reliability
        svg.querySelectorAll("path").forEach((path) => {
          path.removeAttribute("style");
          path.classList.add("hyperlinksWavePath");
        });

        container.replaceChildren(svg);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [svgSrc, tone]);

  return <div ref={containerRef} className="hyperlinksWaveHost" />;
}
