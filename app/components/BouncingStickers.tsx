"use client";

import { useEffect, useRef } from "react";

const STICKER_SIZE = 44;
const SPEED = 3.6;

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
    vx: Math.cos(angle) * SPEED,
    vy: Math.sin(angle) * SPEED,
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

function tickStickers(stickers: StickerData[], w: number, h: number): void {
  const maxX = w - STICKER_SIZE;
  const maxY = h - STICKER_SIZE;

  for (const s of stickers) {
    s.x += s.vx;
    s.y += s.vy;

    if (s.x <= 0) {
      s.x = 0;
      s.vx = Math.abs(s.vx);
    }
    if (s.x >= maxX) {
      s.x = maxX;
      s.vx = -Math.abs(s.vx);
    }
    if (s.y <= 0) {
      s.y = 0;
      s.vy = Math.abs(s.vy);
    }
    if (s.y >= maxY) {
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

      const half = overlap / 2;
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

export default function BouncingStickers({ links }: { links: string[] }) {
  const stickersRef = useRef<StickerData[]>([]);
  const stickerElsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const linksList =
    links.length >= 5 ? links.slice(0, 5) : [...links, "/"];

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    stickersRef.current = STICKER_SOURCES.map((src) => initSticker(src, w, h));

    stickerElsRef.current.forEach((el, i) => {
      const s = stickersRef.current[i];
      if (el && s) {
        el.style.left = `${s.x}px`;
        el.style.top = `${s.y}px`;
      }
    });

    let lastFrame = 0;

    function loop(now: number) {
      if (now - lastFrame < 32) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      lastFrame = now;

      const current = stickersRef.current;
      tickStickers(current, window.innerWidth, window.innerHeight);

      stickerElsRef.current.forEach((el, i) => {
        const s = current[i];
        if (el && s) {
          el.style.left = `${s.x}px`;
          el.style.top = `${s.y}px`;
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
            loading="lazy"
            decoding="async"
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
