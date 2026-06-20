"use client";

import { useEffect, useRef } from "react";

const STICKER_SIZE = 44;
const SPEED_PX_PER_SEC = 240;
const PHYSICS_STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 32;

type StickerData = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  src: string;
};

function randomVelocity(): { vx: number; vy: number } {
  const angle = Math.random() * Math.PI * 2;
  return {
    vx: Math.cos(angle) * SPEED_PX_PER_SEC,
    vy: Math.sin(angle) * SPEED_PX_PER_SEC,
  };
}

function initSticker(src: string, w: number, h: number): StickerData {
  const vel = randomVelocity();
  return {
    src,
    x: Math.random() * Math.max(0, w - STICKER_SIZE),
    y: Math.random() * Math.max(0, h - STICKER_SIZE),
    vx: vel.vx,
    vy: vel.vy,
  };
}

function reflectVelocity(
  vx: number,
  vy: number,
  nx: number,
  ny: number,
): { vx: number; vy: number } {
  const dot = vx * nx + vy * ny;
  return {
    vx: vx - 2 * dot * nx,
    vy: vy - 2 * dot * ny,
  };
}

function tickStickers(
  stickers: StickerData[],
  w: number,
  h: number,
  dtMs: number,
): void {
  const dt = dtMs / 1000;
  const maxX = Math.max(0, w - STICKER_SIZE);
  const maxY = Math.max(0, h - STICKER_SIZE);

  for (const s of stickers) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (s.x < 0) {
      s.x = 0;
      s.vx = Math.abs(s.vx);
    } else if (s.x > maxX) {
      s.x = maxX;
      s.vx = -Math.abs(s.vx);
    }

    if (s.y < 0) {
      s.y = 0;
      s.vy = Math.abs(s.vy);
    } else if (s.y > maxY) {
      s.y = maxY;
      s.vy = -Math.abs(s.vy);
    }
  }

  for (let i = 0; i < stickers.length; i++) {
    for (let j = i + 1; j < stickers.length; j++) {
      const a = stickers[i];
      const b = stickers[j];

      const overlapX =
        Math.min(a.x + STICKER_SIZE, b.x + STICKER_SIZE) - Math.max(a.x, b.x);
      const overlapY =
        Math.min(a.y + STICKER_SIZE, b.y + STICKER_SIZE) - Math.max(a.y, b.y);

      if (overlapX <= 0 || overlapY <= 0) continue;

      let nx: number;
      let ny: number;
      let overlap: number;
      if (overlapX < overlapY) {
        nx = a.x + STICKER_SIZE / 2 < b.x + STICKER_SIZE / 2 ? -1 : 1;
        ny = 0;
        overlap = overlapX;
      } else {
        nx = 0;
        ny = a.y + STICKER_SIZE / 2 < b.y + STICKER_SIZE / 2 ? 1 : -1;
        overlap = overlapY;
      }

      const aReflected = reflectVelocity(a.vx, a.vy, nx, ny);
      const bReflected = reflectVelocity(b.vx, b.vy, -nx, -ny);

      a.vx = aReflected.vx;
      a.vy = aReflected.vy;
      b.vx = bReflected.vx;
      b.vy = bReflected.vy;

      const half = Math.min(overlap / 2, 3);
      a.x -= nx * half;
      a.y -= ny * half;
      b.x += nx * half;
      b.y += ny * half;
    }
  }
}

const STICKER_SOURCES = [
  "/hyperlinks/Stikars/4iza.svg",
  "/hyperlinks/Stikars/maska.svg",
  "/hyperlinks/Stikars/walley.svg",
] as const;

function applyStickerTransform(el: HTMLElement, s: StickerData): void {
  el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
}

export default function BouncingStickers({ links }: { links: string[] }) {
  const stickersRef = useRef<StickerData[]>([]);
  const stickerElsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const linksList =
    links.length >= 5 ? links.slice(0, 5) : [...links, "/"];

  useEffect(() => {
    STICKER_SOURCES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    const w = window.innerWidth;
    const h = window.innerHeight;
    stickersRef.current = STICKER_SOURCES.map((src) => initSticker(src, w, h));

    stickerElsRef.current.forEach((el, i) => {
      const s = stickersRef.current[i];
      if (el && s) {
        applyStickerTransform(el, s);
      }
    });

    let lastTime = performance.now();
    let accumulator = 0;

    function loop(now: number) {
      const frameMs = Math.min(Math.max(now - lastTime, 0), MAX_FRAME_MS);
      lastTime = now;
      accumulator += frameMs;

      const current = stickersRef.current;
      const boundsW = window.innerWidth;
      const boundsH = window.innerHeight;

      while (accumulator >= PHYSICS_STEP_MS) {
        tickStickers(current, boundsW, boundsH, PHYSICS_STEP_MS);
        accumulator -= PHYSICS_STEP_MS;
      }

      stickerElsRef.current.forEach((el, i) => {
        const s = current[i];
        if (el && s) {
          applyStickerTransform(el, s);
        }
      });

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      className="bouncing-stickers-wrapper"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2147483647,
      }}
    >
      {STICKER_SOURCES.map((src, i) => (
        <a
          key={src}
          ref={(el) => {
            stickerElsRef.current[i] = el;
          }}
          href="#"
          className="bouncing-sticker"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: STICKER_SIZE,
            height: STICKER_SIZE,
            pointerEvents: "auto",
            cursor: "pointer",
            display: "block",
          }}
          onClick={(e) => {
            e.preventDefault();
            const href =
              linksList[Math.floor(Math.random() * linksList.length)] ?? "/";
            if (href.startsWith("http")) {
              window.open(href, "_blank", "noopener,noreferrer");
            } else {
              window.location.href = href;
            }
          }}
        >
          <img
            src={src}
            alt=""
            width={STICKER_SIZE}
            height={STICKER_SIZE}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
        </a>
      ))}
    </div>
  );
}
