"use client";

import { useEffect, useRef } from "react";

interface TrailPoint {
  x: number;
  y: number;
  time: number;
  intensity: number;
}

interface Ripple {
  x: number;
  y: number;
  startTime: number;
  radius: number;
  intensity: number;
  hue: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

/** Discrete brand triad — no yellow wash from hue lerps */
const BRAND = {
  green: 145,
  orange: 24,
  blue: 218,
} as const;

const BRAND_LIST = [BRAND.green, BRAND.orange, BRAND.blue] as const;

type Paint = {
  dark: boolean;
  sat: number;
  light: number;
  alphaMul: number;
  fade: string;
  /** How the full-frame fade is composited (light must erase, not paint white) */
  fadeOp: GlobalCompositeOperation;
  /** CSS mix-blend-mode on the overlay canvas */
  blend: string;
};

function resolvePaint(): Paint {
  if (typeof document === "undefined") {
    return {
      dark: true,
      sat: 100,
      light: 62,
      alphaMul: 1.15,
      fade: "rgba(4, 7, 6, 0.22)",
      fadeOp: "source-over",
      blend: "screen",
    };
  }
  const dark =
    document.documentElement.getAttribute("data-theme") !== "light";
  return dark
    ? {
        dark: true,
        sat: 100,
        light: 62,
        alphaMul: 1.15,
        fade: "rgba(4, 7, 6, 0.22)",
        fadeOp: "source-over",
        blend: "screen",
      }
    : {
        // Light: sharp jewel accents on pure white
        dark: false,
        sat: 100,
        light: 46,
        alphaMul: 0.72,
        fade: "rgba(0, 0, 0, 0.18)",
        fadeOp: "destination-out",
        blend: "normal",
      };
}

function brandHue(t: number, salt = 0): number {
  // Slow discrete cycle (~2.2s per hue) — no yellow mid-lerp
  const idx = Math.floor(t * 0.45 + salt) % 3;
  return BRAND_LIST[(idx + 3) % 3];
}

function hs(hue: number, a: number, paint: Paint): string {
  let sat = paint.sat;
  let light = paint.light;
  if (!paint.dark) {
    if (hue >= 120 && hue <= 170) {
      sat = 100;
      light = 42;
    } else if (hue <= 40) {
      sat = 100;
      light = 48;
    } else {
      sat = 100;
      light = 46;
    }
  }
  return `hsla(${hue}, ${sat}%, ${light}%, ${Math.min(1, a * paint.alphaMul)})`;
}

export default function CursorSmudge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const isCoarse =
      window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!ctx) return;

    let paint = resolvePaint();
    canvas.style.mixBlendMode = paint.blend;

    const trails: TrailPoint[] = [];
    const ripples: Ripple[] = [];
    const particles: Particle[] = [];
    const mouse = { x: -1, y: -1 };
    let cursorR = 72;
    let raf = 0;
    let lastRipple = 0;
    let lastParticle = 0;
    let running = true;
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cursorR = Math.min(88, Math.max(52, Math.min(w, h) * 0.09));
    };
    resize();

    const onTheme = () => {
      paint = resolvePaint();
      canvas.style.mixBlendMode = paint.blend;
    };
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      trails.push({ x: e.clientX, y: e.clientY, time: now, intensity: 1 });
      if (trails.length > 10) trails.shift();

      if (now - lastRipple > 700) {
        lastRipple = now;
        ripples.push({
          x: e.clientX,
          y: e.clientY,
          startTime: now,
          radius: 0,
          intensity: 1,
          hue: brandHue(now * 0.001),
        });
        if (ripples.length > 4) ripples.shift();
      }
      if (running && !raf) raf = requestAnimationFrame(frame);
    };

    const onClick = (e: PointerEvent) => {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        startTime: performance.now(),
        radius: 0,
        intensity: 1,
        hue: brandHue(performance.now() * 0.001, 1),
      });
      if (ripples.length > 5) ripples.shift();
      if (running && !raf) raf = requestAnimationFrame(frame);
    };

    const onVis = () => {
      running = !document.hidden;
      if (running && !raf) raf = requestAnimationFrame(frame);
    };

    const onLeave = () => {
      mouse.x = -1;
      mouse.y = -1;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onClick, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVis);

    const spawnCap = isCoarse ? 12 : 28;

    const frame = (now: number) => {
      if (!running) {
        raf = 0;
        return;
      }
      t = now * 0.001;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const idle =
        trails.length === 0 &&
        ripples.length === 0 &&
        particles.length === 0 &&
        mouse.x < 0;

      if (idle) {
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, w, h);
        raf = 0;
        return;
      }

      ctx.globalCompositeOperation = paint.fadeOp;
      ctx.fillStyle = paint.fade;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      // Trails — few, vivid, modest radius
      for (let i = trails.length - 1; i >= 0; i--) {
        const tr = trails[i];
        const age = (now - tr.time) / 1000;
        tr.intensity = 1 - age * 1.8;
        if (tr.intensity <= 0) {
          trails.splice(i, 1);
          continue;
        }
        const r = cursorR * 0.55 * tr.intensity;
        const hx = brandHue(t, i);
        const hy = brandHue(t + 0.4, i + 1);
        const g = ctx.createRadialGradient(tr.x, tr.y, 0, tr.x, tr.y, r);
        g.addColorStop(0, hs(hx, 0.5 * tr.intensity, paint));
        g.addColorStop(0.45, hs(hy, 0.28 * tr.intensity, paint));
        g.addColorStop(1, hs(hx, 0, paint));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Occasional brand particles (cheap rects, no shadows)
      if (
        !isCoarse &&
        particles.length < spawnCap &&
        now - lastParticle > 180 &&
        Math.random() < 0.04
      ) {
        lastParticle = now;
        const edge = Math.floor(Math.random() * 4);
        let x = 0;
        let y = 0;
        let vx = 0;
        let vy = 0;
        const spd = 6 + Math.random() * 10;
        if (edge === 0) {
          x = Math.random() * w;
          y = -4;
          vy = spd;
          vx = (Math.random() - 0.5) * 2;
        } else if (edge === 1) {
          x = w + 4;
          y = Math.random() * h;
          vx = -spd;
          vy = (Math.random() - 0.5) * 2;
        } else if (edge === 2) {
          x = Math.random() * w;
          y = h + 4;
          vy = -spd;
          vx = (Math.random() - 0.5) * 2;
        } else {
          x = -4;
          y = Math.random() * h;
          vx = spd;
          vy = (Math.random() - 0.5) * 2;
        }
        particles.push({
          x,
          y,
          vx,
          vy,
          life: 0,
          maxLife: 1400 + Math.random() * 1600,
          size: 1 + Math.random() * 3,
          hue: BRAND_LIST[Math.floor(Math.random() * 3)],
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life += 16;
        if (
          p.life > p.maxLife ||
          p.x < -40 ||
          p.x > w + 40 ||
          p.y < -40 ||
          p.y > h + 40
        ) {
          particles.splice(i, 1);
          continue;
        }
        const a = 1 - p.life / p.maxLife;
        ctx.fillStyle = hs(p.hue, a * 0.85, paint);
        const s = p.size;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }

      // Ripples — 3 rings, no shadowBlur
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        const progress = (now - rp.startTime) / 1600;
        if (progress >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        rp.radius = progress * 280;
        rp.intensity = 1 - progress;
        for (let ring = 0; ring < 3; ring++) {
          const rr = rp.radius - ring * 36;
          if (rr <= 0) continue;
          const a = (1 - ring / 3) * rp.intensity * 0.55;
          ctx.strokeStyle = hs(BRAND_LIST[(ring + Math.floor(rp.hue)) % 3], a, paint);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Cursor bloom
      if (mouse.x >= 0 && !isCoarse) {
        const wx = Math.sin(t * 2.4) * 4;
        const wy = Math.cos(t * 2.1) * 4;
        const cx = mouse.x + wx;
        const cy = mouse.y + wy;
        const h1 = brandHue(t);
        const h2 = brandHue(t + 0.55, 1);
        const h3 = brandHue(t + 1.1, 2);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cursorR);
        g.addColorStop(0, hs(h1, 0.58, paint));
        g.addColorStop(0.35, hs(h2, 0.32, paint));
        g.addColorStop(0.7, hs(h3, 0.14, paint));
        g.addColorStop(1, hs(h1, 0, paint));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, cursorR, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 1; i <= 2; i++) {
          ctx.strokeStyle = hs(BRAND_LIST[i % 3], 0.18 / i, paint);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, cursorR + i * cursorR * 0.22, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onClick);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
