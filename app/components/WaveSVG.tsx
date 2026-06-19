"use client";

import { useEffect, useRef } from "react";

interface WaveSVGProps {
  svgSrc: string;
}

export default function WaveSVG({ svgSrc }: WaveSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const setup = async () => {
      const svgContent = await fetch(svgSrc).then((r) => r.text());
      if (cancelled || !containerRef.current) return;

      const doc = new DOMParser().parseFromString(svgContent, "image/svg+xml");
      const svgElement = doc.querySelector("svg");
      if (!svgElement) return;

      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute("width", "100%");
      clonedSvg.setAttribute("height", "100%");
      clonedSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      clonedSvg.style.width = "100%";
      clonedSvg.style.height = "100%";
      clonedSvg.style.display = "block";
      clonedSvg.style.overflow = "visible";
      clonedSvg.style.willChange = "transform";

      const filterId = `wave-${Math.random().toString(36).slice(2, 9)}`;
      const ns = "http://www.w3.org/2000/svg";
      const defs = document.createElementNS(ns, "defs");
      const filter = document.createElementNS(ns, "filter");
      filter.setAttribute("id", filterId);
      filter.setAttribute("x", "-12%");
      filter.setAttribute("y", "-12%");
      filter.setAttribute("width", "124%");
      filter.setAttribute("height", "124%");

      const turbulence = document.createElementNS(ns, "feTurbulence");
      turbulence.setAttribute("type", "fractalNoise");
      turbulence.setAttribute("baseFrequency", "0.012 0.018");
      turbulence.setAttribute("numOctaves", "3");
      turbulence.setAttribute("seed", "2");
      turbulence.setAttribute("result", "noise");

      const displacement = document.createElementNS(ns, "feDisplacementMap");
      displacement.setAttribute("in", "SourceGraphic");
      displacement.setAttribute("in2", "noise");
      displacement.setAttribute("scale", "10");
      displacement.setAttribute("xChannelSelector", "R");
      displacement.setAttribute("yChannelSelector", "G");

      filter.append(turbulence, displacement);
      defs.appendChild(filter);
      clonedSvg.insertBefore(defs, clonedSvg.firstChild);
      clonedSvg.setAttribute("filter", `url(#${filterId})`);

      container.innerHTML = "";
      container.appendChild(clonedSvg);

      const start = performance.now();
      const animate = (now: number) => {
        const t = (now - start) * 0.001;
        const freqX = 0.009 + Math.sin(t * 0.35) * 0.004;
        const freqY = 0.014 + Math.cos(t * 0.28) * 0.005;
        const scale = 8 + Math.sin(t * 0.45) * 3 + Math.cos(t * 0.22) * 1.5;
        turbulence.setAttribute("baseFrequency", `${freqX} ${freqY}`);
        displacement.setAttribute("scale", String(scale));
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    };

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [svgSrc]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      }}
    />
  );
}
