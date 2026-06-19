"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CursorSmudge = dynamic(() => import("./CursorSmudge"), { ssr: false });
const BouncingStickers = dynamic(() => import("./BouncingStickers"), {
  ssr: false,
});

export default function DeferredEffects({ links }: { links: string[] }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let cancelled = false;

    const mount = () => {
      if (!cancelled) setReady(true);
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(mount, { timeout: 1200 });
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(id);
      };
    }

    const timeoutId = window.setTimeout(mount, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <CursorSmudge />
      <BouncingStickers links={links} />
    </>
  );
}
