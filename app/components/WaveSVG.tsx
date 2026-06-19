"use client";

import { useEffect, useRef } from "react";

interface WaveSVGProps {
  svgSrc: string;
}

export default function WaveSVG({ svgSrc }: WaveSVGProps) {
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

        svg.querySelectorAll("path").forEach((path, index) => {
          path.classList.add("hyperlinksWavePath");
          path.style.animationDelay = `${index * 0.12}s`;
        });

        container.replaceChildren(svg);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [svgSrc]);

  return (
    <div
      ref={containerRef}
      className="hyperlinksWaveHost"
    />
  );
}
