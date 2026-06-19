"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CursorSmudge = dynamic(() => import("./CursorSmudge"), { ssr: false });
const BouncingStickers = dynamic(() => import("./BouncingStickers"), {
  ssr: false,
});

export default function DeferredEffects({ links }: { links: string[] }) {
  const [showStickers, setShowStickers] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let cancelled = false;
    const stickerTimer = window.setTimeout(() => {
      if (!cancelled) setShowStickers(true);
    }, 350);

    const enableCursor = () => {
      if (!cancelled) setShowCursor(true);
    };

    window.addEventListener("pointermove", enableCursor, { once: true, passive: true });
    window.addEventListener("touchstart", enableCursor, { once: true, passive: true });
    const cursorTimer = window.setTimeout(enableCursor, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(stickerTimer);
      window.clearTimeout(cursorTimer);
      window.removeEventListener("pointermove", enableCursor);
      window.removeEventListener("touchstart", enableCursor);
    };
  }, []);

  return (
    <>
      {showStickers ? <BouncingStickers links={links} /> : null}
      {showCursor ? <CursorSmudge /> : null}
    </>
  );
}
