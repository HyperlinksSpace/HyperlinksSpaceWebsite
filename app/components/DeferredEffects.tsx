"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CursorSmudge = dynamic(() => import("./CursorSmudge"), { ssr: false });
const BouncingStickers = dynamic(() => import("./BouncingStickers"), {
  ssr: false,
});
const FloatingBlackHole = dynamic(() => import("./FloatingBlackHole"), {
  ssr: false,
});

function isLowPower() {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.connection?.saveData) return true;
  if (nav.connection?.effectiveType === "2g" || nav.connection?.effectiveType === "slow-2g")
    return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return true;
  if (window.innerWidth <= 768) return true;
  if (window.matchMedia("(pointer: coarse)").matches) return true;
  return false;
}

function whenIdle(cb: () => void, timeout: number) {
  const w = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(() => cb(), { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(cb, Math.min(timeout, 600));
  return () => window.clearTimeout(t);
}

export default function DeferredEffects({ links }: { links: string[] }) {
  const [showStickers, setShowStickers] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const [showBlackHole, setShowBlackHole] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const low = isLowPower();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    if (reduced) return;

    // Paint the page first; stagger heavy effects so load feels instant
    cleanups.push(
      whenIdle(() => {
        if (!cancelled) setShowBlackHole(true);
      }, low ? 1800 : 800)
    );

    cleanups.push(
      whenIdle(() => {
        if (!cancelled) setShowStickers(true);
      }, low ? 3200 : 2000)
    );

    if (!coarse) {
      const enableCursor = () => {
        if (!cancelled) setShowCursor(true);
      };
      window.addEventListener("pointermove", enableCursor, {
        once: true,
        passive: true,
      });
      const cursorTimer = window.setTimeout(enableCursor, low ? 6000 : 3500);
      cleanups.push(() => {
        window.clearTimeout(cursorTimer);
        window.removeEventListener("pointermove", enableCursor);
      });
    }

    return () => {
      cancelled = true;
      for (const c of cleanups) c();
    };
  }, []);

  return (
    <>
      {showBlackHole ? <FloatingBlackHole /> : null}
      {showStickers ? <BouncingStickers links={links} /> : null}
      {showCursor ? <CursorSmudge /> : null}
    </>
  );
}
