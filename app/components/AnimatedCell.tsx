"use client";

import { useEffect, useRef, useState } from "react";
import WaveSVG from "./WaveSVG";

interface AnimatedCellProps {
  n: number;
  href: string;
  svgSrc: string;
}

export default function AnimatedCell({ n, href, svgSrc }: AnimatedCellProps) {
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const [aspectRatio, setAspectRatio] = useState({ scaleX: 1, scaleY: 1 });

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const updateAspectRatio = () => {
      setAspectRatio({
        scaleX: 0.78 + Math.random() * 0.44,
        scaleY: 0.78 + Math.random() * 0.44,
      });
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.random() * 2000 + 1000;
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
          <div
            ref={svgWrapperRef}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${aspectRatio.scaleX}, ${aspectRatio.scaleY})`,
              transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              transformOrigin: "center center",
              willChange: "transform",
            }}
          >
            <WaveSVG svgSrc={svgSrc} />
          </div>
        </div>
      </div>
    </a>
  );
}
