"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useEarth, type EarthSettings } from "./EarthContext";
import { useTheme } from "./ThemeContext";

/**
 * Floating Earth inspired by nxrix eclipses
 * (https://nxrix.github.io/notebooks/eclipses) — day/night globe,
 * moon umbra, and atmosphere rim. Drag like the black hole.
 */

const DAY_URL = "/earth/day.jpg";
const NIGHT_URL = "/earth/night.jpg";

const GLOW_PAD = 1.35; // canvas larger than globe for atmosphere / overshine

const EARTH_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SHARED_GLSL = /* glsl */ `
const float PI = 3.141592653589793;
const float R_SUN = 109.0757;
const float R_MOON = 0.27247;

uniform vec3 uSunPos;
uniform vec3 uMoonPos;
uniform bool uRealShadows;

float moonObscuration0(vec3 p) {
  vec3 toSun = uSunPos - p;
  vec3 toMoon = uMoonPos - p;
  float ds = length(toSun);
  float dm = length(toMoon);
  float alpha = asin(clamp(R_SUN / ds, 0.0, 1.0));
  float beta = asin(clamp(R_MOON / dm, 0.0, 1.0));
  float d = atan(length(cross(toSun, toMoon)), dot(toSun, toMoon));
  if (d >= alpha + beta) return 0.0;
  if (beta > alpha && d <= beta - alpha) return 1.0;
  if (d < 1.0e-7) return clamp(beta * beta / (alpha * alpha), 0.0, 1.0);
  float d2 = d * d, a2 = alpha * alpha, b2 = beta * beta;
  float A = a2 * acos(clamp((d2 + a2 - b2) / (2.0 * d * alpha), -1.0, 1.0));
  float B = b2 * acos(clamp((d2 + b2 - a2) / (2.0 * d * beta), -1.0, 1.0));
  float C = sqrt(max(0.0, (-d + alpha + beta) * (d + alpha - beta) * (d - alpha + beta) * (d + alpha + beta)));
  return clamp((A + B - 0.5 * C) / (PI * a2), 0.0, 1.0);
}

float moonObscuration(vec3 p) {
  float a = moonObscuration0(p);
  if (uRealShadows) return a;
  if (a >= 1.0) return 1.0;
  return floor(a * 6.0) / 6.0;
}
`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDayTex;
uniform sampler2D uNightTex;
uniform float uOvershine;
uniform float uIsLight;
uniform float uExposure;

varying vec2 vUv;
varying vec3 vPos;

${SHARED_GLSL}

void main() {
  vec3 n = normalize(vPos);
  vec3 sunDir = normalize(uSunPos - vPos);
  float ndl = max(dot(n, sunDir), 0.0);
  float obsc = moonObscuration(vPos);

  vec3 dayCol = texture2D(uDayTex, vUv).rgb;
  vec3 nightCol = texture2D(uNightTex, vUv).rgb;
  dayCol = max(dayCol, vec3(0.05, 0.12, 0.28));
  nightCol = max(nightCol, vec3(0.02, 0.03, 0.08));

  float s = dot(n, sunDir);
  /* Wide terminator — keep most of the front lit and readable. */
  float dayF = smoothstep(-0.35, 0.25, s);
  float city = smoothstep(-0.05, 0.08, max(nightCol.r, nightCol.g) - nightCol.b);
  nightCol *= mix(1.15 + city * 1.4, 0.7 + city * 0.35, uIsLight);

  vec3 litDay = dayCol * (0.45 + 0.75 * ndl);
  vec3 litNight = nightCol * mix(0.85, 0.55, uIsLight);
  vec3 col = mix(litNight, litDay, dayF);

  /* Eclipse umbra dims but never kills the map. */
  col *= mix(1.0, 0.22, obsc);

  float mx = max(max(dayCol.r, dayCol.g), dayCol.b);
  float blueness = (dayCol.b - max(dayCol.r, dayCol.g)) / max(mx, 1e-4);
  float water = smoothstep(0.10, 0.30, blueness) * 0.55 + 0.08;
  vec3 viewDir = normalize(cameraPosition - vPos);
  vec3 h = normalize(sunDir + viewDir);
  float spec = pow(max(dot(n, h), 0.0), 48.0);
  col += water * spec * vec3(1.0, 0.97, 0.9) * ndl * (1.0 - obsc);

  /* Ambient fill + theme exposure (overshine on light). */
  col += dayCol * mix(0.18, 0.28, uIsLight);
  float exposure = uExposure * mix(1.15, 1.0 + 0.65 * uOvershine, uIsLight);
  col *= exposure;

  gl_FragColor = vec4(col, 1.0);
}
`;

const ATMO_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uSunPos;
uniform vec3 uMoonPos;
uniform bool uRealShadows;
uniform float uAtmosphere;
uniform float uOvershine;
uniform float uIsLight;

varying vec3 vNormal;
varying vec3 vWorldPos;

${SHARED_GLSL}

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.4);
  vec3 sunDir = normalize(uSunPos - vWorldPos);
  float sunLit = smoothstep(-0.15, 0.45, dot(n, sunDir));
  float obsc = moonObscuration(normalize(vWorldPos));

  vec3 rimDark = vec3(0.25, 0.55, 1.0);
  vec3 rimLight = vec3(0.55, 0.85, 1.15);
  vec3 rim = mix(rimDark, rimLight, uIsLight);
  float a = fres * (0.35 + 0.65 * sunLit) * (1.0 - obsc * 0.7) * uAtmosphere;
  a *= mix(0.85, 1.15 + 0.5 * uOvershine, uIsLight);
  a += fres * mix(0.12, 0.28 * uOvershine, uIsLight);

  gl_FragColor = vec4(rim * a, a);
}
`;

function makePlaceholderTex(kind: "day" | "night"): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  if (kind === "day") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#7ec8ff");
    g.addColorStop(0.35, "#2f6b3a");
    g.addColorStop(0.55, "#1e4d8c");
    g.addColorStop(0.75, "#3d8b4f");
    g.addColorStop(1, "#9ad0ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(40,120,60,0.55)";
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.ellipse(
        (i * 97) % w,
        40 + ((i * 53) % (h - 80)),
        30 + (i % 5) * 12,
        18 + (i % 4) * 8,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#02040a";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      const x = (i * 47) % w;
      const y = (i * 91) % h;
      ctx.fillStyle = `rgba(255,${200 + (i % 40)},${140 + (i % 30)},${0.15 + (i % 5) * 0.08})`;
      ctx.fillRect(x, y, 1 + (i % 2), 1 + (i % 2));
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function loadTextures(): Promise<{ day: THREE.Texture; night: THREE.Texture }> {
  const loader = new THREE.TextureLoader();
  const load = (url: string) =>
    new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
  return Promise.all([load(DAY_URL), load(NIGHT_URL)]).then(([day, night]) => ({
    day,
    night,
  }));
}

function optimizeTex(tex: THREE.Texture, maxAnisotropy: number) {
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
}

/** Keep the Sun mostly in front of the camera so the globe stays readable. */
function bodyPositions(
  t: number,
  speed: number,
  eclipse: number
): { sun: THREE.Vector3; moon: THREE.Vector3 } {
  const wobble = t * 0.22 * speed;
  const sun = new THREE.Vector3(
    Math.sin(wobble) * 90.0,
    55.0 + Math.sin(wobble * 0.6) * 25.0,
    210.0
  );

  const cycle = (Math.sin(t * 0.08 * speed) * 0.5 + 0.5) * eclipse;
  const align = Math.pow(cycle, 1.4);
  const moon = sun
    .clone()
    .normalize()
    .multiplyScalar(THREE.MathUtils.lerp(70, 48, align));
  // Offset sideways when not eclipsing so the disc isn't always umbra.
  moon.x += THREE.MathUtils.lerp(28, 0.5, align);
  moon.y += THREE.MathUtils.lerp(12, 0.2, align);
  return { sun, moon };
}

export default function FloatingEarth() {
  const { settings, setSettings } = useEarth();
  const { resolved } = useTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  const themeRef = useRef(resolved);
  const setSettingsRef = useRef(setSettings);
  settingsRef.current = settings;
  themeRef.current = resolved;
  setSettingsRef.current = setSettings;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const handle = handleRef.current;
    if (!wrap || !canvas || !handle) return;

    let cancelled = false;
    let raf = 0;
    const drag = { active: false, ox: 0, oy: 0 };
    const pos = { x: 0, y: 0, ready: false };

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
    camera.position.set(0, 0.15, 3.35);
    camera.lookAt(0, 0, 0);

    const placeholderDay = makePlaceholderTex("day");
    const placeholderNight = makePlaceholderTex("night");

    const uniforms = {
      uDayTex: { value: placeholderDay as THREE.Texture },
      uNightTex: { value: placeholderNight as THREE.Texture },
      uSunPos: { value: new THREE.Vector3(40, 60, 210) },
      uMoonPos: { value: new THREE.Vector3(70, 20, 50) },
      uRealShadows: { value: true },
      uOvershine: { value: 1 },
      uIsLight: { value: 0 },
      uExposure: { value: 1.35 },
      uAtmosphere: { value: 1 },
    };

    const earthMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
      lights: false,
    });
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 72),
      earthMat
    );
    scene.add(earth);

    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunPos: uniforms.uSunPos,
        uMoonPos: uniforms.uMoonPos,
        uRealShadows: uniforms.uRealShadows,
        uAtmosphere: uniforms.uAtmosphere,
        uOvershine: uniforms.uOvershine,
        uIsLight: uniforms.uIsLight,
      },
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.045, 64, 48),
      atmoMat
    );
    scene.add(atmo);

    let t0 = performance.now();
    let elapsed = 0;

    const applySize = (s: EarthSettings) => {
      const px = Math.round(s.size * GLOW_PAD);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(px, px, false);
      wrap.style.width = `${px}px`;
      wrap.style.height = `${px}px`;
      handle.style.width = `${s.size}px`;
      handle.style.height = `${s.size}px`;
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };

    const clampPos = (s: EarthSettings) => {
      const px = s.size * GLOW_PAD;
      const maxX = Math.max(0, window.innerWidth - px);
      const maxY = Math.max(0, window.innerHeight - px);
      pos.x = Math.min(maxX, Math.max(0, pos.x));
      pos.y = Math.min(maxY, Math.max(0, pos.y));
    };

    const applyTransform = () => {
      wrap.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    };

    const applyPositionRatios = (p: { xRatio: number; yRatio: number }) => {
      const px = settingsRef.current.size * GLOW_PAD;
      pos.x = p.xRatio * window.innerWidth - px * 0.5;
      pos.y = p.yRatio * window.innerHeight - px * 0.5;
      clampPos(settingsRef.current);
      applyTransform();
      pos.ready = true;
    };

    const savePosition = () => {
      const px = settingsRef.current.size * GLOW_PAD;
      const cx = pos.x + px * 0.5;
      const cy = pos.y + px * 0.5;
      const next = {
        xRatio: Math.min(1, Math.max(0, cx / Math.max(window.innerWidth, 1))),
        yRatio: Math.min(1, Math.max(0, cy / Math.max(window.innerHeight, 1))),
      };
      setSettingsRef.current((s) => ({ ...s, position: next }));
    };

    const placeDefault = () => {
      const px = settingsRef.current.size * GLOW_PAD;
      pos.x = Math.max(0, window.innerWidth * 0.72 - px * 0.5);
      pos.y = Math.max(0, window.innerHeight * 0.55 - px * 0.5);
      clampPos(settingsRef.current);
      applyTransform();
      pos.ready = true;
    };

    applySize(settingsRef.current);
    if (settingsRef.current.position) {
      applyPositionRatios(settingsRef.current.position);
    } else {
      placeDefault();
    }

    const earthCenter = () => {
      const px = settingsRef.current.size * GLOW_PAD;
      const globe = settingsRef.current.size;
      return {
        cx: pos.x + px * 0.5,
        cy: pos.y + px * 0.5,
        r: globe * 0.5,
      };
    };

    const isHot = (clientX: number, clientY: number) => {
      if (!settingsRef.current.enabled) return false;
      const { cx, cy, r } = earthCenter();
      return Math.hypot(clientX - cx, clientY - cy) <= r;
    };

    const isSiteChrome = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          ".bhSettingsWrapper, .themeSwitchWrapper, .langSwitchWrapper, .bhSettingsPanel, #bh-settings-panel, .bhDragHandle, .liquidDropDragHandle"
        )
      );
    };

    const onMove = (e: PointerEvent) => {
      if (!drag.active) return;
      e.preventDefault();
      pos.x = e.clientX - drag.ox;
      pos.y = e.clientY - drag.oy;
      clampPos(settingsRef.current);
      applyTransform();
    };

    const endDrag = (e: PointerEvent) => {
      if (!drag.active) return;
      drag.active = false;
      handle.classList.remove("is-dragging");
      document.documentElement.classList.remove("bh-dragging");
      clampPos(settingsRef.current);
      applyTransform();
      savePosition();
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      updateHover(e.clientX, e.clientY, e.target);
    };

    const beginDrag = (e: PointerEvent) => {
      drag.active = true;
      drag.ox = e.clientX - pos.x;
      drag.oy = e.clientY - pos.y;
      handle.classList.add("is-dragging");
      document.documentElement.classList.add("bh-dragging");
      document.documentElement.classList.remove("bh-grab-hover");
      handle.style.pointerEvents = "auto";
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    };

    const updateHover = (
      clientX: number,
      clientY: number,
      target: EventTarget | null
    ) => {
      if (drag.active) return;
      const hot = isHot(clientX, clientY) && !isSiteChrome(target);
      handle.classList.toggle("is-hot", hot);
      document.documentElement.classList.toggle("bh-grab-hover", hot);
      handle.style.pointerEvents = hot ? "auto" : "none";
    };

    const onHoverMove = (e: PointerEvent) => {
      if (drag.active) return;
      updateHover(e.clientX, e.clientY, e.target);
    };

    const onDownCapture = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (drag.active) return;
      if (isSiteChrome(e.target)) return;
      if (!isHot(e.clientX, e.clientY)) return;
      e.preventDefault();
      e.stopPropagation();
      beginDrag(e);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (drag.active) return;
      if (!isHot(e.clientX, e.clientY)) return;
      e.preventDefault();
      e.stopPropagation();
      beginDrag(e);
    };

    handle.style.pointerEvents = "none";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!reducedMotion) {
      window.addEventListener("pointermove", onHoverMove, { passive: true });
      window.addEventListener("pointerdown", onDownCapture, true);
      handle.addEventListener("pointerdown", onDown);
    }

    const onResize = () => {
      clampPos(settingsRef.current);
      applyTransform();
      applySize(settingsRef.current);
    };
    window.addEventListener("resize", onResize);

    let lastSize = settingsRef.current.size;
    let lastPosKey = settingsRef.current.position
      ? `${settingsRef.current.position.xRatio}:${settingsRef.current.position.yRatio}`
      : "";

    loadTextures()
      .then(({ day, night }) => {
        if (cancelled) {
          day.dispose();
          night.dispose();
          return;
        }
        const maxA = renderer.capabilities.getMaxAnisotropy();
        optimizeTex(day, maxA);
        optimizeTex(night, maxA);
        const prevDay = uniforms.uDayTex.value;
        const prevNight = uniforms.uNightTex.value;
        uniforms.uDayTex.value = day;
        uniforms.uNightTex.value = night;
        if (prevDay && prevDay !== day) prevDay.dispose();
        if (prevNight && prevNight !== night) prevNight.dispose();
        earthMat.needsUpdate = true;
      })
      .catch((err) => {
        console.warn("[FloatingEarth] texture load failed, using placeholder", err);
      });

    const frame = (now: number) => {
      if (cancelled) return;
      const s = settingsRef.current;
      wrap.style.display = s.enabled ? "" : "none";
      if (!s.enabled) {
        raf = requestAnimationFrame(frame);
        return;
      }

      if (s.size !== lastSize) {
        lastSize = s.size;
        applySize(s);
        clampPos(s);
        applyTransform();
      }

      const posKey = s.position
        ? `${s.position.xRatio}:${s.position.yRatio}`
        : "";
      if (posKey !== lastPosKey) {
        lastPosKey = posKey;
        if (s.position && !drag.active) applyPositionRatios(s.position);
      }

      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      if (s.play) elapsed += dt * s.speed;

      const light = themeRef.current === "light" ? 1 : 0;
      const overshine = light
        ? Math.max(s.overshine, 1.25) * 1.2
        : Math.max(s.overshine, 0.9);

      uniforms.uIsLight.value = light;
      uniforms.uOvershine.value = overshine;
      uniforms.uExposure.value = light ? 1.55 : 1.4;
      uniforms.uAtmosphere.value = s.atmosphere;
      uniforms.uRealShadows.value = s.realShadows;

      if (s.play) {
        earth.rotation.y += dt * s.spin * 0.35;
        const bodies = bodyPositions(elapsed, 1, s.eclipse);
        uniforms.uSunPos.value.copy(bodies.sun);
        uniforms.uMoonPos.value.copy(bodies.moon);
      } else {
        // Still keep a bright key light when paused.
        uniforms.uSunPos.value.set(40, 60, 210);
      }

      wrap.classList.toggle("is-light", light === 1);
      wrap.style.filter = light
        ? "saturate(1.15) brightness(1.12) contrast(1.05)"
        : "saturate(1.05) brightness(1.08)";
      renderer.render(scene, camera);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      if (!reducedMotion) {
        handle.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onHoverMove);
        window.removeEventListener("pointerdown", onDownCapture, true);
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      document.documentElement.classList.remove("bh-grab-hover", "bh-dragging");
      uniforms.uDayTex.value?.dispose();
      uniforms.uNightTex.value?.dispose();
      earth.geometry.dispose();
      atmo.geometry.dispose();
      earthMat.dispose();
      atmoMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className="floatingEarthRoot" aria-hidden="true">
      <canvas ref={canvasRef} className="floatingEarthCanvas" />
      <div
        ref={handleRef}
        className="earthDragHandle"
        aria-label="Drag Earth"
        title="Drag"
      />
    </div>
  );
}
