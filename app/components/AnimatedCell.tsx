"use client";

import { useEffect, useRef } from "react";
import WaveSVG from "./WaveSVG";

interface AnimatedCellProps {
  n: number;
  href: string;
  svgSrc: string;
}

export default function AnimatedCell({ n, href, svgSrc }: AnimatedCellProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const updateAspectRatio = () => {
      const scaleX = 0.88 + Math.random() * 0.24;
      const scaleY = 0.88 + Math.random() * 0.24;
      wrapper.style.transform = `translate3d(0,0,0) scale(${scaleX}, ${scaleY})`;
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.random() * 3200 + 2800;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        updateAspectRatio();
        scheduleNext();
      }, delay);
    };

    updateAspectRatio();
    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const tone = (Math.min(4, Math.max(1, n)) as 1 | 2 | 3 | 4);

  return (
    <a
      className="hyperlinksCell"
      href={href}
      aria-label={`Open link ${n}`}
      target={href === "#" ? undefined : "_blank"}
      rel={href === "#" ? undefined : "noopener noreferrer"}
    >
      <div className="hyperlinksImagePad">
        <div className="hyperlinksImageContainer">
          <div ref={wrapperRef} className="hyperlinksSvgWrapper">
            <WaveSVG svgSrc={svgSrc} tone={tone} />
          </div>
        </div>
      </div>
    </a>
  );
}
