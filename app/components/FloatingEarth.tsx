"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useEarth, type EarthSettings } from "./EarthContext";
import { useTheme } from "./ThemeContext";

/**
 * Floating Earth matching nxrix eclipses framing & look
 * https://nxrix.github.io/notebooks/eclipses
 * https://github.com/nxrix/nxrix.github.io
 */

const DAY_URL = "/earth/day.jpg";
const NIGHT_URL = "/earth/night.jpg";

/** Reference canvas is 4:3 (Observable resize: h = w * 0.75). */
const ASPECT = 4 / 3;

const EARTH_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ATMO_VERT = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Exact obscuration + atmosphere from nxrix eclipses (clouds omitted). */
const SHARED_GLSL = /* glsl */ `
const float PI  = 3.141592653589793;
const float R_SUN  = 109.0757;
const float R_MOON = 0.27247;

uniform vec3 uSunPos;
uniform vec3 uMoonPos;
uniform bool uRealShadows;

float moonObscuration0(vec3 p) {
  vec3 toSun  = uSunPos  - p;
  vec3 toMoon = uMoonPos - p;
  float ds = length(toSun);
  float dm = length(toMoon);
  float alpha = asin(clamp(R_SUN  / ds, 0.0, 1.0));
  float beta  = asin(clamp(R_MOON / dm, 0.0, 1.0));
  float d = atan(length(cross(toSun, toMoon)), dot(toSun, toMoon));
  if (d >= alpha + beta) return 0.0;
  if (beta > alpha && d <= beta - alpha) return 1.0;
  if (d < 1.0e-7) return clamp(beta*beta/(alpha*alpha), 0.0, 1.0);
  float d2 = d*d, a2 = alpha*alpha, b2 = beta*beta;
  float A = a2 * acos(clamp((d2 + a2 - b2) / (2.0*d*alpha), -1.0, 1.0));
  float B = b2 * acos(clamp((d2 + b2 - a2) / (2.0*d*beta ), -1.0, 1.0));
  float C = sqrt(max(0.0, (-d+alpha+beta)*(d+alpha-beta)*(d-alpha+beta)*(d+alpha+beta)));
  return clamp((A + B - 0.5*C) / (PI*a2), 0.0, 1.0);
}

float moonObscuration(vec3 p) {
  float a = moonObscuration0(p);
  if (uRealShadows) return a;
  else if (a>=1.0) return 1.0;
  else return floor(a*6.0)/6.0;
}

vec2 raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r*r;
  float disc = b*b - c;
  if (disc < 0.0) return vec2(-1.0);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}

#define R_EARTH  1.0
#define R_ATMO   1.0157
#define H_R      0.015
#define H_M      0.004
#define BETA_R   vec3(3.8, 13.5, 33.1)
#define BETA_M   vec3(21.0)

const float MIE_EX   = 1.1;
const float MIE_G    = -0.78;

float rayleighPhase(float cosT) {
  return 3.0 / (16.0 * PI) * (1.0 + cosT * cosT);
}

float miePhase(float g, float c, float cc) {
  float gg = g * g;
  float a = (1.0 - gg) * (1.0 + cc);
  float b = 1.0 + gg - 2.0 * g * c;
  b *= sqrt(b);
  b *= 2.0 + gg;
  return (3.0 / (8.0 * PI)) * a / b;
}

float densityRay(vec3 p) { return exp(-max(length(p) - R_EARTH, 0.0) / H_R); }
float densityMie(vec3 p) { return exp(-max(length(p) - R_EARTH, 0.0) / H_M); }

vec3 sunTransmittance(vec3 p, out float earthOcc, out vec3 sunDir, out float moonObsc) {
  vec3 toSun = uSunPos - p;
  sunDir = normalize(toSun);
  vec2 tESun = raySphere(p, sunDir, R_EARTH);
  earthOcc = (tESun.x > 0.0) ? 0.0 : 1.0;
  if (earthOcc < 0.5) return vec3(0.0);
  moonObsc = moonObscuration(p);

  vec2 tASun = raySphere(p, sunDir, R_ATMO);
  float chord = max(tASun.y, 0.0);
  vec3 pA = p + (chord * 0.25) * sunDir;
  vec3 pB = p + (chord * 0.75) * sunDir;
  float stepLen = chord * 0.5;
  vec3 tau = (BETA_R * (densityRay(pA) + densityRay(pB))
            + BETA_M * MIE_EX * (densityMie(pA) + densityMie(pB))) * stepLen;
  return exp(-tau);
}

vec3 sky(vec3 ro, vec3 rd) {
  vec2 tA = raySphere(ro, rd, R_ATMO);
  if (tA.x < 0.0) return vec3(0.0);
  float tStart = max(tA.x, 0.0);
  float tEnd   = tA.y;
  vec2 tE = raySphere(ro, rd, R_EARTH);
  if (tE.x > 0.0) tEnd = min(tEnd, tE.x);
  if (tStart >= tEnd) return vec3(0.0);

  float tMid     = (tStart + tEnd) * 0.5;
  float sliceLen = (tEnd - tStart) * 0.5;

  vec3 pFront = ro + ((tStart + tMid) * 0.5) * rd;
  vec3 pBack  = ro + ((tMid   + tEnd) * 0.5) * rd;

  vec3 sigmaRF = BETA_R * densityRay(pFront) * sliceLen;
  vec3 sigmaMF = BETA_M * densityMie(pFront) * sliceLen;
  vec3 sigmaRB = BETA_R * densityRay(pBack)  * sliceLen;
  vec3 sigmaMB = BETA_M * densityMie(pBack)  * sliceLen;
  vec3 sigmaF  = sigmaRF + sigmaMF;
  vec3 sigmaB  = sigmaRB + sigmaMB;

  float earthOccF, moonObscF; vec3 sunDirF;
  vec3 transSunF = sunTransmittance(pFront, earthOccF, sunDirF, moonObscF);
  float sunVisF  = earthOccF * (1.0 - moonObscF);

  float earthOccB, moonObscB; vec3 sunDirB;
  vec3 transSunB = sunTransmittance(pBack, earthOccB, sunDirB, moonObscB);
  float sunVisB  = earthOccB * (1.0 - moonObscB);

  float cF = dot(sunDirF, -rd);
  float cB = dot(sunDirB, -rd);
  float phaseR_F = rayleighPhase(cF);
  float phaseR_B = rayleighPhase(cB);
  float phaseM_F = miePhase(MIE_G, cF, cF * cF);
  float phaseM_B = miePhase(MIE_G, cB, cB * cB);

  vec3 L_front =
        sunVisF * transSunF
      * (phaseR_F * (1.0 - exp(-sigmaRF))
       + phaseM_F * (1.0 - exp(-sigmaMF)));

  vec3 L_back =
        sunVisB * transSunB * exp(-sigmaF)
      * (phaseR_B * (1.0 - exp(-sigmaRB))
       + phaseM_B * (1.0 - exp(-sigmaMB)));

  return (L_front + L_back) * 10.0;
}
`;

/** Exact earth fragment from nxrix, plus light-theme overshine. */
const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDayTex;
uniform sampler2D uNightTex;
uniform float uOvershine;
uniform float uIsLight;
uniform float uAtmosphere;

varying vec2 vUv;
varying vec3 vPos;

${SHARED_GLSL}

#define TAU_V vec3(0.055, 0.115, 0.245)

void main() {
  vec3 n = normalize(vPos);
  vec3 sunDir = normalize(uSunPos - vPos);
  float ndl  = max(dot(n, sunDir), 0.0);
  float obsc = moonObscuration(vPos);
  ndl = mix(ndl, 0.04, obsc);
  vec3 dayCol   = texture2D(uDayTex,   vUv).rgb;
  vec3 nightCol = texture2D(uNightTex, vUv).rgb;

  float s     = dot(n, sunDir);
  float dayF  = smoothstep(-0.08, 0.03, s);
  vec3  sunT  = exp(-TAU_V * (1.0 / (ndl + 0.028)));

  float light = smoothstep(-0.1, 0.001, max(nightCol.r, nightCol.g) - nightCol.b);
  float nf = max(1.0 - dayF*sunT.z,0.0);
  nightCol *= 1.0 + light * (1.0-dayF*1.5);
  /* Light theme: slightly mute cities, lift day (overshine). */
  nightCol *= mix(1.0, 0.65, uIsLight);
  vec3 col = dayCol * sunT * dayF * (1.0 - obsc) + nightCol * nf;

  float mx = max(max(dayCol.r, dayCol.g), dayCol.b);
  float blueness = (dayCol.b - max(dayCol.r, dayCol.g))/max(mx,1e-4);
  float water = smoothstep(0.10, 0.30, blueness)*0.6+0.05;
  vec3 viewDir = normalize(cameraPosition - vPos);

  vec3  h = normalize(sunDir + viewDir);
  float spec = pow(max(dot(n, h), 0.0), 90.0);
  col += water * spec * vec3(1.0, 0.95, 0.85) * ndl * (1.0 - obsc);

  col *= mix(1.0, 1.0 + 0.35 * uOvershine, uIsLight);
  col += mix(vec3(0.0), dayCol * 0.06 * uOvershine * dayF, uIsLight);

  gl_FragColor = vec4(col,1.0);
}
`;

const ATMO_FRAG = /* glsl */ `
uniform float uAtmosphere;
uniform float uOvershine;
uniform float uIsLight;

varying vec3 vPos;

${SHARED_GLSL}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vPos - ro);
  vec3 col = sky(ro, rd) * uAtmosphere;
  col *= mix(1.0, 1.0 + 0.45 * uOvershine, uIsLight);
  gl_FragColor = vec4(col, 1.0);
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
    g.addColorStop(0.4, "#1e4d8c");
    g.addColorStop(0.7, "#2f6b3a");
    g.addColorStop(1, "#9ad0ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = "#02040a";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(255,220,160,${0.2 + (i % 5) * 0.1})`;
      ctx.fillRect((i * 47) % w, (i * 91) % h, 1, 1);
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

function makeGlowTexture(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  g.addColorStop(0.0, "rgba(255,252,240,1)");
  g.addColorStop(0.25, "rgba(255,236,180,0.85)");
  g.addColorStop(0.5, "rgba(255,190,90,0.30)");
  g.addColorStop(0.75, "rgba(255,150,50,0.07)");
  g.addColorStop(1.0, "rgba(255,130,30,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/**
 * Body scales match nxrix (Earth radius = 1, Sun ~23000, Moon ~60).
 * Animate a slow orbit with periodic near-alignment for eclipses.
 */
function bodyPositions(
  t: number,
  speed: number,
  eclipse: number
): { sun: THREE.Vector3; moon: THREE.Vector3 } {
  const sunAng = t * 0.08 * speed;
  const sunDist = 23000;
  const sun = new THREE.Vector3(
    Math.cos(sunAng) * sunDist,
    Math.sin(sunAng * 0.12) * 1800,
    Math.sin(sunAng) * sunDist
  );

  const cycle = (Math.sin(t * 0.05 * speed) * 0.5 + 0.5) * eclipse;
  const align = Math.pow(cycle, 1.5);
  // Moon near the sun-line when aligning (solar eclipse umbra on Earth).
  const moonDist = THREE.MathUtils.lerp(60, 48, align);
  const moonDir = sun.clone().normalize();
  const side = new THREE.Vector3(0, 1, 0).cross(moonDir).normalize();
  const moon = moonDir
    .multiplyScalar(moonDist)
    .add(side.multiplyScalar(THREE.MathUtils.lerp(18, 0.4, align)));
  return { sun, moon };
}

function canvasSize(widthPx: number) {
  const w = Math.round(widthPx);
  const h = Math.round(w / ASPECT);
  return { w, h };
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
      preserveDrawingBuffer: false,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();

    // Match nxrix: PerspectiveCamera(45), spherical (3.2, 1.5, 2.0)
    const camera = new THREE.PerspectiveCamera(45, ASPECT, 0.25, 24000);
    camera.position.setFromSphericalCoords(3.2, 1.5, 2.0);
    camera.lookAt(0, 0, 0);

    const placeholderDay = makePlaceholderTex("day");
    const placeholderNight = makePlaceholderTex("night");

    const uniforms = {
      uDayTex: { value: placeholderDay as THREE.Texture },
      uNightTex: { value: placeholderNight as THREE.Texture },
      uSunPos: { value: new THREE.Vector3(23000, 0, 0) },
      uMoonPos: { value: new THREE.Vector3(0, 0, 60) },
      uRealShadows: { value: true },
      uOvershine: { value: 1 },
      uIsLight: { value: 0 },
      uAtmosphere: { value: 1 },
    };

    const earthMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
    });
    // nxrix: SphereGeometry(1, 160, 120)
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 160, 120),
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
    });
    // nxrix: SphereGeometry(1.02, 96, 64)
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.02, 96, 64),
      atmoMat
    );
    scene.add(atmo);

    const sunGlowTex = makeGlowTexture();
    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunGlowTex,
        color: 0xffe9b0,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunGlow.scale.setScalar(109 * 8);
    sunGlow.position.set(23000, 0, 0);
    scene.add(sunGlow);

    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(109, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0xfff2a8 })
    );
    sunMesh.position.set(23000, 0, 0);
    scene.add(sunMesh);

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x888888 })
    );
    moonMesh.position.set(0, 0, 60);
    scene.add(moonMesh);

    let t0 = performance.now();
    let elapsed = 0;

    const applySize = (s: EarthSettings) => {
      // size = reference width (nxrix ~720 = 512 * 1.40625)
      const { w, h } = canvasSize(s.size);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      wrap.style.width = `${w}px`;
      wrap.style.height = `${h}px`;
      // Hotspot = globe footprint (~circle inscribed in 4:3)
      const hot = Math.min(w, h) * 0.72;
      handle.style.width = `${hot}px`;
      handle.style.height = `${hot}px`;
      camera.aspect = w / h;
      // nxrix: zoom = a <= 1 ? a : 1
      camera.zoom = camera.aspect <= 1 ? camera.aspect : 1;
      camera.updateProjectionMatrix();
    };

    const clampPos = (s: EarthSettings) => {
      const { w, h } = canvasSize(s.size);
      pos.x = Math.min(Math.max(0, window.innerWidth - w), Math.max(0, pos.x));
      pos.y = Math.min(Math.max(0, window.innerHeight - h), Math.max(0, pos.y));
    };

    const applyTransform = () => {
      wrap.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    };

    const applyPositionRatios = (p: { xRatio: number; yRatio: number }) => {
      const { w, h } = canvasSize(settingsRef.current.size);
      pos.x = p.xRatio * window.innerWidth - w * 0.5;
      pos.y = p.yRatio * window.innerHeight - h * 0.5;
      clampPos(settingsRef.current);
      applyTransform();
      pos.ready = true;
    };

    const savePosition = () => {
      const { w, h } = canvasSize(settingsRef.current.size);
      const cx = pos.x + w * 0.5;
      const cy = pos.y + h * 0.5;
      setSettingsRef.current((s) => ({
        ...s,
        position: {
          xRatio: Math.min(1, Math.max(0, cx / Math.max(window.innerWidth, 1))),
          yRatio: Math.min(1, Math.max(0, cy / Math.max(window.innerHeight, 1))),
        },
      }));
    };

    const placeDefault = () => {
      const { w, h } = canvasSize(settingsRef.current.size);
      pos.x = Math.max(0, window.innerWidth * 0.62 - w * 0.5);
      pos.y = Math.max(0, window.innerHeight * 0.48 - h * 0.5);
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
      const { w, h } = canvasSize(settingsRef.current.size);
      const hot = Math.min(w, h) * 0.72;
      return {
        cx: pos.x + w * 0.5,
        cy: pos.y + h * 0.5,
        r: hot * 0.5,
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
      })
      .catch((err) => {
        console.warn("[FloatingEarth] texture load failed", err);
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
      uniforms.uIsLight.value = light;
      uniforms.uOvershine.value = light
        ? Math.max(s.overshine, 1.2)
        : s.overshine;
      uniforms.uAtmosphere.value = s.atmosphere;
      uniforms.uRealShadows.value = s.realShadows;

      if (s.play) {
        earth.rotation.y += dt * s.spin * 0.25;
        const bodies = bodyPositions(elapsed, 1, s.eclipse);
        uniforms.uSunPos.value.copy(bodies.sun);
        uniforms.uMoonPos.value.copy(bodies.moon);
        sunMesh.position.copy(bodies.sun);
        sunGlow.position.copy(bodies.sun);
        moonMesh.position.copy(bodies.moon);
      }

      wrap.classList.toggle("is-light", light === 1);
      wrap.style.filter = light ? "brightness(1.06) saturate(1.08)" : "none";
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
      sunGlowTex.dispose();
      earth.geometry.dispose();
      atmo.geometry.dispose();
      sunMesh.geometry.dispose();
      moonMesh.geometry.dispose();
      (sunMesh.material as THREE.Material).dispose();
      (moonMesh.material as THREE.Material).dispose();
      (sunGlow.material as THREE.Material).dispose();
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
