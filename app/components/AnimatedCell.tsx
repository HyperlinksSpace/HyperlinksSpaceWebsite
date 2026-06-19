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

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const updateAspectRatio = () => {
      const scaleX = 0.82 + Math.random() * 0.36;
      const scaleY = 0.82 + Math.random() * 0.36;
      wrapper.style.transform = `translate3d(0,0,0) scale(${scaleX}, ${scaleY})`;
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.random() * 2500 + 2000;
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
            <WaveSVG svgSrc={svgSrc} />
          </div>
        </div>
      </div>
    </a>
  );
}
