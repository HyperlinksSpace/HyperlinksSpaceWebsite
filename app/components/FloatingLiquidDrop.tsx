"use client";

import { useEffect, useRef } from "react";
import { LiquidGlass } from "../lib/liquidGlass";
import {
  useLiquidDrop,
  type LiquidDropSettings,
} from "./LiquidDropContext";
import { useTheme } from "./ThemeContext";

/**
 * Chaos bolts + liquid rim shading from Hyperlinks Space Program
 * (`liquidGlassThreeSession.ts`), drawn over an nxrix-style backdrop glass drop.
 */

const RAY_MARGIN_PX = 14;
const PHYSICS_STEP_MS = 1000 / 30;
const MAX_FRAME_MS = 48;
const PHASE = Math.random();

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

/* Circle-only port of Program liquid-glass + chaos bolts (GLSL 300 es). */
const FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float uTime;
uniform float uPhase;
uniform float uIsLight;
uniform float uChipPx;
uniform float uViewPx;
uniform float uBoltWidthTune;
uniform float uBoltIntensity;
uniform float uGlassAmount;
uniform float uLightning;

float ltHash3(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

void addChaosBolt(vec2 p, float ang, float ltTime, float k, float maxLen01, float weight, float beamThin, inout float sh, inout float gl) {
  float rp = length(p);
  if (rp < 1e-5) return;
  float a = atan(p.y, p.x);
  float da0 = a - ang;
  da0 = da0 - 6.2831853 * floor((da0 + 3.14159265) / 6.2831853);
  float along = cos(da0) * rp;
  if (along < 0.0) return;
  float bend = sin(along * 35.0 + ltTime * (2.05 + fract(k * 0.31) * 2.15) + k * 2.45) * 0.36;
  bend += sin(along * 10.2 - ltTime * 1.22 + k * 1.58) * 0.16;
  bend += along * (0.12 + 0.10 * sin(ltTime * 1.02 + k * 2.75));
  bend += sin(along * 58.0 + ltTime * 4.35 + k * 3.1) * 0.048;
  float angCur = ang + bend;
  float daB = a - angCur;
  daB = daB - 6.2831853 * floor((daB + 3.14159265) / 6.2831853);
  float perp = abs(sin(daB)) * rp;
  float wig = sin(along * 88.0 + ltTime * (6.5 + fract(k * 0.37) * 4.0) + k * 3.4) * 0.0029;
  wig += sin(along * 205.0 - ltTime * (5.1 + fract(k * 0.19) * 3.0) + k * 5.2) * 0.00125;
  wig += sin(along * 47.0 + ltTime * 2.7 + k * 1.9) * 0.0011;
  perp += abs(wig) * clamp(rp, 0.008, 0.16) * 0.9;
  float lenWobble = sin(ltTime * 3.8 + k * 2.6) * 0.034 + sin(ltTime * 7.1 + along * 22.0) * 0.018;
  float lenCap = maxLen01 * 0.51 + lenWobble;
  lenCap = clamp(lenCap, 0.12, 0.58);
  float lenChop = (1.0 - smoothstep(lenCap * 0.82, lenCap * 1.06, along)) * smoothstep(0.012, 0.052, along);
  float br = abs(sin(daB - 0.14 * sin(along * 18.0 + k * 2.1 + ltTime * 1.7))) * rp;
  float w = max(weight, 0.0);
  float uBr1 = along * (84.0 + fract(k * 0.47) * 38.0) + ltTime * (13.8 + fract(k * 0.23) * 10.5) + k * 5.05;
  float uBr2 = along * (31.0 + fract(k * 0.33) * 17.0) - ltTime * (10.3 + fract(k * 0.31) * 7.8) + k * 2.33;
  float uBr3 = along * (118.0 + fract(k * 0.19) * 44.0) + ltTime * (17.5 + fract(k * 0.41) * 12.0) + k * 7.15;
  float uBr4 = along * (9.2 + fract(k * 0.27) * 5.5) + ltTime * 0.88 + k * 1.05;
  float brFine = pow(0.5 + 0.5 * sin(uBr1), 3.05);
  float brMed = pow(0.5 + 0.5 * sin(uBr2 + 0.6 * sin(uBr1 * 0.31)), 1.95);
  float brCoarse = smoothstep(0.12, 0.88, 0.5 + 0.5 * sin(uBr3));
  float brChunk = step(0.44, fract(uBr4)) * step(fract(uBr4 + 0.37), 0.72);
  float broken = clamp(brFine * brMed * (0.18 + 0.82 * brCoarse) * (0.28 + 0.72 * max(brChunk, 0.35 + 0.65 * brFine)), 0.0, 1.0);
  float brokenCore = mix(0.10, 1.0, pow(broken, 0.45));
  float brokenGlow = 0.38 + 0.62 * sqrt(broken);
  float fJ1 = fract(along * 67.0 + k * 8.17 + ltTime * 2.35);
  float fJ2 = fract(along * 131.0 - ltTime * 4.25 + k * 3.94);
  float fJ3 = fract(along * 44.0 + sin(ltTime * 6.8 + k * 2.6) * 0.42);
  float strictSeg =
    smoothstep(0.02, 0.10, fJ1) * (1.0 - smoothstep(0.91, 0.99, fJ1))
    * smoothstep(0.22, 0.38, fJ2) * smoothstep(0.10, 0.22, fJ3);
  float microZig = smoothstep(0.42, 0.58, fract(along * 203.0 + k * 13.2 + ltTime * 1.1));
  float boltJag = strictSeg * (0.52 + 0.48 * microZig);
  boltJag = max(boltJag, 0.42);
  float pe = perp * beamThin;
  float be = br * beamThin;
  sh += exp(-pe * pe * 52000.0) * 1.38 * lenChop * w * 1.42 * brokenCore * boltJag;
  sh += exp(-be * be * 42000.0) * 0.18 * lenChop * w * 1.42 * brokenCore * boltJag;
  gl += (exp(-pe * pe * 2200.0) * 0.09 + exp(-be * be * 1500.0) * 0.03) * lenChop * w * 0.08 * brokenGlow * boltJag;
}

void main() {
  float viewScale = uViewPx / max(uChipPx, 1.0);
  vec2 puFull = v_uv - 0.5;
  vec2 puGlass = puFull * viewScale;
  float studioHlGate = step(43.0, uChipPx);
  float r0 = length(puGlass);
  float theta = atan(puGlass.y, puGlass.x);
  float t = uTime + uPhase * 6.2831853;
  float slow = t * 0.52 + uPhase * 1.15;

  float w = sin(2.0 * theta + slow * 0.82 + uPhase * 1.35) * 0.58
          + sin(4.0 * theta - slow * 0.62 + uPhase * 0.75) * 0.30
          + sin(6.0 * theta + slow * 0.38 + uPhase * 2.1) * 0.12;
  float swell = sin(slow * 0.78 + uPhase * 2.25) * 0.24;
  w = w * 0.90 + swell;
  float EDGE_AMP = 0.032;
  float rEdge = 0.5 + EDGE_AMP * clamp(w, -1.15, 1.15);

  vec2 flow = vec2(
    sin(puGlass.y * 5.5 + t * 0.38) * 0.028 + cos(puGlass.x * 4.8 - t * 0.26) * 0.016,
    cos(puGlass.x * 5.2 - t * 0.32) * 0.028 + sin(puGlass.y * 5.0 + t * 0.22) * 0.016
  );
  float flowMask = (1.0 - smoothstep(0.05, 0.42, r0)) * (1.0 - smoothstep(rEdge - 0.08, rEdge + 0.02, r0));
  vec2 pw = puGlass + flow * flowMask;
  float rw = length(pw);

  float edgeMask = 1.0 - smoothstep(rEdge - 0.030, rEdge + 0.006, r0);

  float cap = 0.565;
  float h2 = cap * cap - dot(pw, pw);
  float hz = h2 > 0.0 ? sqrt(h2) : 0.0;
  vec3 N = normalize(vec3(pw * 2.62, hz * 2.22 + 0.001));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float ndv = clamp(dot(N, V), 0.0, 1.0);

  float F0 = mix(0.052, 0.02, uIsLight);
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);

  vec2 refr = normalize(puGlass + vec2(1e-5));
  float px = (1.0 - ndv) * mix(0.145, 0.125, uIsLight);
  float rR = length(pw + refr * px * 0.11 + vec2(0.006 * (1.0 - ndv), 0.0));
  float rG = length(pw + refr * px * 0.11);
  float rB = length(pw + refr * px * 0.11 - vec2(0.006 * (1.0 - ndv), 0.0));

  vec3 envIn = mix(vec3(0.148, 0.15, 0.155), vec3(0.992, 0.996, 1.0), uIsLight);
  vec3 envOut = mix(vec3(0.24, 0.25, 0.29), vec3(0.948, 0.968, 0.992), uIsLight);
  float sR = smoothstep(0.0, 0.5, rR);
  float sG = smoothstep(0.0, 0.5, rG);
  float sB = smoothstep(0.0, 0.5, rB);
  float sUni = (sR + sG + sB) / 3.0;
  vec3 envChr = vec3(
    mix(envIn.r, envOut.r, sR),
    mix(envIn.g, envOut.g, sG),
    mix(envIn.b, envOut.b, sB)
  );
  vec3 envFlat = mix(envIn, envOut, sUni);
  vec3 env = mix(envChr, envFlat, uIsLight);

  vec3 frostC = mix(vec3(0.18, 0.19, 0.22), vec3(0.998, 0.999, 1.0), uIsLight);
  float frostAmt = (1.0 - ndv) * mix(0.44, 0.018, uIsLight);
  frostAmt *= mix(0.38, 1.0, studioHlGate);
  env = mix(env, frostC, frostAmt);
  float crown = pow(ndv, 2.2);
  env += mix(vec3(0.02, 0.022, 0.028), vec3(0.004, 0.0045, 0.006), uIsLight) * crown * mix(0.12, 1.0, studioHlGate);

  float caust = sin(pw.y * 14.0 + t * 0.55) * cos(pw.x * 12.0 - t * 0.42);
  vec3 caustCol =
    vec3(0.48, 0.72, 1.0) * caust * mix(0.036, 0.0, uIsLight) * (1.0 - smoothstep(0.28, 0.52, rw));
  caustCol *= mix(0.15, 1.0, studioHlGate);

  vec3 Lk = normalize(vec3(-0.38, 0.62, 1.0));
  float ndl = max(dot(N, Lk), 0.0);
  float specT = pow(ndl, mix(118.0, 220.0, uIsLight));
  float specB = pow(ndl, 18.0) * mix(0.24, 0.07, uIsLight);
  float specAmt = mix(0.52, 0.36, uIsLight);
  vec3 refl = mix(vec3(0.84, 0.91, 1.0), vec3(1.0), uIsLight);
  vec3 body = env + caustCol;
  float fresMix = mix(0.76, 0.54, uIsLight);
  vec3 col = mix(body, refl, fresnel * fresMix * mix(0.40, 1.0, studioHlGate));
  col += vec3((specT + specB) * specAmt) * mix(0.14, 1.0, studioHlGate);

  float rPu = length(puGlass);
  vec2 puN = rPu > 1e-4 ? puGlass / rPu : vec2(0.0);
  float rimAz = dot(puN, normalize(vec2(-0.72, -0.69)));

  vec2 hlUv = v_uv - vec2(0.26, 0.19);
  float hl = exp(-dot(hlUv, hlUv) * mix(11.5, 22.0, uIsLight)) * mix(0.11, 0.06, uIsLight) * studioHlGate;
  col += vec3(hl);
  vec2 glUv = v_uv - vec2(0.30, 0.24);
  float glint = exp(-dot(glUv, glUv) * mix(38.0, 58.0, uIsLight)) * mix(0.09, 0.05, uIsLight) * studioHlGate;
  col += vec3(glint);
  float grazingSpec = pow(1.0 - ndv, mix(5.0, 12.0, uIsLight)) * (1.0 - uIsLight) * 0.26;
  col += vec3(grazingSpec) * (0.55 + 0.45 * smoothstep(-0.15, 0.88, rimAz)) * mix(0.18, 1.0, studioHlGate);

  vec2 brLit = normalize(vec2(0.58, -0.46));
  float innerSh = smoothstep(0.12, 0.5, rw) * max(0.0, dot(puN, brLit));
  col *= 1.0 - innerSh * mix(0.12, 0.018, uIsLight);

  float dEdge = rEdge - r0;
  float bead = smoothstep(0.0, 0.014, dEdge) * (1.0 - smoothstep(0.014, 0.045, dEdge));
  float beadAsym = mix(0.88, 1.0, uIsLight * smoothstep(-0.35, 0.92, rimAz));
  col += vec3(1.0) * bead * beadAsym * mix(0.38, 0.14, uIsLight) * mix(0.1, 1.0, studioHlGate);

  float rimDef = exp(-dEdge * 58.0) * smoothstep(0.006, 0.042, dEdge) * (1.0 - smoothstep(0.05, 0.11, dEdge));
  col += vec3(1.0) * rimDef * uIsLight * (0.05 + 0.10 * smoothstep(-0.2, 0.95, rimAz)) * studioHlGate;
  col += vec3(0.07, 0.085, 0.11) * rimDef * (1.0 - uIsLight) * mix(0.45, 1.0, studioHlGate);

  float dispEdge = (1.0 - smoothstep(0.0, 0.018, dEdge)) * fresnel;
  float disp = dispEdge * mix(1.0, 0.05, uIsLight) * mix(0.35, 1.0, studioHlGate);
  col.r += disp * 0.055;
  col.b += disp * 0.04;
  col.g -= disp * 0.025;

  float iris = smoothstep(rEdge - 0.16, rEdge - 0.02, r0) * smoothstep(0.2, 0.85, sin(theta * 0.5 + 0.8));
  col += vec3(1.0, 0.85, 0.95) * iris * 0.045 * sin(t * 1.2 + theta * 2.5) * (1.0 - uIsLight);

  float shd = smoothstep(-0.15, 0.35, puGlass.y) * (1.0 - ndv) * mix(0.075, 0.010, uIsLight);
  col *= (1.0 - shd);

  float ltShell = smoothstep(0.15, 0.41, r0) * (1.0 - smoothstep(0.44, 0.53, r0));
  col *= 1.0 - ltShell * mix(0.32, 0.07, uIsLight);

  vec3 glassCol = col;

  float wTargetPx = clamp(clamp(uChipPx * 0.011, 0.34, 0.58) * uBoltWidthTune, 0.18, 2.0);
  float ltBeamThin = (1.0 / sqrt(52000.0)) * uChipPx / max(wTargetPx, 0.22);
  ltBeamThin = clamp(ltBeamThin, 0.22, 0.95);
  float ltSmallChip = clamp((46.0 - uChipPx) / 22.0, 0.0, 1.0);

  float ltSeed = ltHash3(vec3(uPhase * 6.18, 2.71, 0.42));
  float ltTime = t * 5.2 + uPhase * 9.0;
  float ltBreathe = mix(
    0.55 + 0.45 * sin(uTime * 6.2 + uPhase * 2.4),
    0.82 + 0.18 * sin(uTime * 6.2 + uPhase * 2.4),
    uIsLight
  );
  float R_DROP = 0.5;
  float R_VIEW = 0.5 * viewScale;
  float boltSpillRim = 1.0 - smoothstep(R_VIEW - 0.035, R_VIEW + 0.045, r0);
  float boltSpill = boltSpillRim;
  float piercePastLiquid = 1.0 + 0.55 * smoothstep(rEdge - 0.02, rEdge + 0.09, r0);
  vec2 ltOrig = vec2(
    sin(ltTime * 0.41 + ltSeed * 5.7) * 0.021 + sin(ltTime * 0.11 + uPhase * 3.1) * 0.011,
    cos(ltTime * 0.35 + ltSeed * 4.2) * 0.019 + cos(ltTime * 0.095 + uPhase * 2.7) * 0.010
  );
  vec2 pLt = puGlass - ltOrig;
  float rLt = length(pLt);
  float flickRaw = 0.42 + 0.58 * pow(0.5 + 0.5 * sin(ltTime * 22.0 + ltSeed * 73.0), 2.4);
  float flick = mix(flickRaw, 0.86 + 0.14 * (flickRaw - 0.42) / 0.58, uIsLight);
  float lenBoost = 1.0 + 0.24 * clamp(viewScale - 1.0, 0.0, 0.55);
  float accSharp = 0.0;
  float accGlow = 0.0;

  for (float fi = 0.0; fi < 7.0; fi += 1.0) {
    float hA = ltHash3(vec3(ltSeed, fi * 1.618, 0.413));
    float hB = ltHash3(vec3(ltSeed, fi * 2.718, 9.069));
    float hC = ltHash3(vec3(ltSeed, fi * 4.201, 3.331));
    float ang = hA * 6.2831853 + sin(ltTime * (0.62 + hB * 1.4) + hB * 6.2831853) * 0.42 + sin(ltTime * (0.21 + hA * 0.9) + fi * 1.77) * 0.19 + ltTime * (0.11 + hB * 0.13);
    float maxLen = mix(0.26, 0.98, hB) * (0.88 + 0.24 * sin(ltTime * 2.9 + fi * 1.3 + hA * 12.0)) * lenBoost;
    float w0 = step(0.12, hC) * (0.50 + 0.50 * pow(0.5 + 0.5 * sin(ltTime * (28.0 + hA * 22.0) + fi * 5.1), 1.72)) * (0.52 + 0.48 * pow(0.5 + 0.5 * sin(ltTime * (17.0 + hC * 31.0) + hB * 18.0), 2.05)) * ltBreathe * (0.58 + 0.42 * hC) * 1.22;
    addChaosBolt(pLt, ang, ltTime, fi * 2.17 + ltSeed * 8.3, maxLen, w0, ltBeamThin, accSharp, accGlow);
  }

  accSharp = clamp(accSharp, 0.0, 13.5);
  accGlow = clamp(accGlow, 0.0, 22.0);
  float pin = exp(-dot(pLt, pLt) * 3600.0) * (0.13 + mix(0.10, 0.045, uIsLight) * sin(ltTime * 33.0 + ltSeed * 50.0)) * (1.0 + 0.20 * ltSmallChip) * mix(0.22, 1.0, studioHlGate);
  vec3 ltCol = mix(vec3(1.0, 1.0, 1.0), vec3(0.0, 0.0, 1.0), uIsLight);
  float pierce = smoothstep(0.006, 0.040, rLt) * smoothstep(0.004, 0.032, r0) * boltSpill * piercePastLiquid;
  float outsideBoost = 1.0 + 0.75 * smoothstep(rEdge + 0.002, rEdge + 0.09, r0) + 0.35 * smoothstep(R_DROP - 0.1, R_DROP - 0.02, r0);
  float rayStretch = 1.0 + 0.88 * smoothstep(0.17, 0.48, r0) + 0.95 * smoothstep(R_DROP + 0.04, R_VIEW - 0.08, r0);
  float sharpVis = accSharp * pierce * flick * outsideBoost * rayStretch * (1.0 + 0.15 * ltSmallChip);
  float glowVis = accGlow * pierce * flick * outsideBoost * rayStretch * (1.0 + 0.15 * ltSmallChip);
  float pastDrop = max(0.0, r0 - rEdge);
  float killBroad = exp(-pastDrop * 30.0);
  vec3 ltRgb = ltCol * (sharpVis * 2.45 + pin * 1.22);
  ltRgb += ltCol * glowVis * killBroad * 0.05;
  float ltAlphaBolt = (
    sharpVis * 1.12
    + glowVis * 0.08 * killBroad
    + pin * 0.72
  ) * boltSpill * 0.88;
  float annulusRay = smoothstep(rEdge - 0.02, rEdge + 0.12, r0) * (1.0 - smoothstep(R_VIEW - 0.06, R_VIEW + 0.02, r0));
  float outsideRay = annulusRay * boltSpill * (
    accGlow * 0.055 * killBroad
    + accSharp * 0.14
  ) * flick * piercePastLiquid * rayStretch;
  float ltAlpha = (ltAlphaBolt + outsideRay * 0.93) * uLightning * uBoltIntensity;
  float rimAtBoost = smoothstep(R_DROP - 0.14, R_DROP - 0.03, r0) * boltSpill * flick * mix(0.20, 0.20, uIsLight) * killBroad * (1.0 - uIsLight) * uLightning * uBoltIntensity;
  float At = clamp(ltAlpha + rimAtBoost, 0.0, 0.84);

  float fill = mix(0.5, 0.40, uIsLight);
  fill += clamp((46.0 - uChipPx) / 46.0, 0.0, 1.0) * mix(0.085, 0.045, uIsLight);
  float aFres = fresnel * mix(0.19, 0.23, uIsLight);
  float aBody = (1.0 - ndv) * mix(0.058, 0.036, uIsLight);
  /* Soft glass veil over real backdrop refraction — keep translucent. */
  float Ag = clamp((fill + aFres + aBody) * edgeMask * uGlassAmount * 0.42, 0.0, mix(0.55, 0.42, uIsLight));
  ltRgb *= uBoltIntensity * uLightning;
  vec3 premulOut = ltRgb * At + glassCol * Ag * (1.0 - At);
  float alpha = At + Ag * (1.0 - At);
  alpha = clamp(alpha, 0.0, mix(0.88, 0.78, uIsLight));
  col = premulOut / max(alpha, 0.00035);
  fragColor = vec4(col, alpha);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const prog = gl.createProgram();
  if (!prog) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

type DropState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

function randomVelocity(speed: number) {
  const angle = Math.random() * Math.PI * 2;
  const mag = 52 * speed;
  return { vx: Math.cos(angle) * mag, vy: Math.sin(angle) * mag };
}

function viewSize(chip: number) {
  return chip + RAY_MARGIN_PX * 2;
}

export default function FloatingLiquidDrop() {
  const { settings, setSettings } = useLiquidDrop();
  const { resolved } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  const themeRef = useRef(resolved);
  const setSettingsRef = useRef(setSettings);
  settingsRef.current = settings;
  themeRef.current = resolved;
  setSettingsRef.current = setSettings;

  useEffect(() => {
    const root = rootRef.current;
    const glass = glassRef.current;
    const canvas = canvasRef.current;
    const handle = handleRef.current;
    if (!root || !glass || !canvas || !handle) return;

    let glassFx: LiquidGlass | null = null;
    let raf = 0;
    let cancelled = false;
    let lastTs = performance.now();
    let acc = 0;
    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    const drag = { active: false, ox: 0, oy: 0 };
    /** Parked after user drag (or restored from settings.position). */
    let parked = Boolean(settingsRef.current.position);

    const state: DropState = {
      x: Math.random() * Math.max(0, viewW - 140),
      y: Math.random() * Math.max(0, viewH - 140),
      ...randomVelocity(settingsRef.current.speed),
    };

    const applyRootTransform = () => {
      root.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
    };

    const syncHandleSize = (chip: number) => {
      handle.style.width = `${chip}px`;
      handle.style.height = `${chip}px`;
    };

    const clampToViewport = (chip: number) => {
      const view = viewSize(chip);
      const maxX = Math.max(0, viewW - view);
      const maxY = Math.max(0, viewH - view);
      state.x = Math.min(maxX, Math.max(0, state.x));
      state.y = Math.min(maxY, Math.max(0, state.y));
    };

    const applyPositionRatios = (pos: { xRatio: number; yRatio: number }) => {
      const chip = settingsRef.current.size;
      const view = viewSize(chip);
      const cx = pos.xRatio * viewW;
      const cy = pos.yRatio * viewH;
      state.x = cx - view * 0.5;
      state.y = cy - view * 0.5;
      clampToViewport(chip);
      state.vx = 0;
      state.vy = 0;
      parked = true;
      applyRootTransform();
    };

    let lastPosKey = settingsRef.current.position
      ? `${settingsRef.current.position.xRatio}:${settingsRef.current.position.yRatio}`
      : "";

    const savePosition = () => {
      const chip = settingsRef.current.size;
      const view = viewSize(chip);
      const cx = state.x + view * 0.5;
      const cy = state.y + view * 0.5;
      const next = {
        xRatio: Math.min(1, Math.max(0, cx / Math.max(viewW, 1))),
        yRatio: Math.min(1, Math.max(0, cy / Math.max(viewH, 1))),
      };
      parked = true;
      state.vx = 0;
      state.vy = 0;
      lastPosKey = `${next.xRatio}:${next.yRatio}`;
      setSettingsRef.current((s) => ({ ...s, position: next }));
      return next;
    };

    const dropCenter = () => {
      const view = viewSize(settingsRef.current.size);
      return {
        cx: state.x + view * 0.5,
        cy: state.y + view * 0.5,
      };
    };

    const isDropHotspot = (clientX: number, clientY: number) => {
      if (!settingsRef.current.enabled) return false;
      const { cx, cy } = dropCenter();
      const r = settingsRef.current.size * 0.5;
      return Math.hypot(clientX - cx, clientY - cy) <= r;
    };

    const isSiteChrome = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          ".bhSettingsWrapper, .themeSwitchWrapper, .langSwitchWrapper, .bhSettingsPanel, #bh-settings-panel, .bhDragHandle"
        )
      );
    };

    const applyGlassOptions = (s: LiquidDropSettings) => {
      const radius = s.size / 2;
      glass.style.width = `${s.size}px`;
      glass.style.height = `${s.size}px`;
      glass.style.borderRadius = `${radius}px`;
      const view = viewSize(s.size);
      root.style.width = `${view}px`;
      root.style.height = `${view}px`;
      syncHandleSize(s.size);
      if (!glassFx) {
        glassFx = new LiquidGlass(glass, {
          strength: s.strength,
          depth: s.depth,
          chromaticAberration: s.chromaticAberration,
          blur: s.blur,
          brightness: s.brightness,
          radius,
        });
      } else {
        glassFx.set({
          strength: s.strength,
          depth: s.depth,
          chromaticAberration: s.chromaticAberration,
          blur: s.blur,
          brightness: s.brightness,
          radius,
        });
      }
    };

    applyGlassOptions(settingsRef.current);

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return;

    const prog = linkProgram(gl, VERT, FRAG);
    if (!prog) return;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uni = {
      uTime: gl.getUniformLocation(prog, "uTime"),
      uPhase: gl.getUniformLocation(prog, "uPhase"),
      uIsLight: gl.getUniformLocation(prog, "uIsLight"),
      uChipPx: gl.getUniformLocation(prog, "uChipPx"),
      uViewPx: gl.getUniformLocation(prog, "uViewPx"),
      uBoltWidthTune: gl.getUniformLocation(prog, "uBoltWidthTune"),
      uBoltIntensity: gl.getUniformLocation(prog, "uBoltIntensity"),
      uGlassAmount: gl.getUniformLocation(prog, "uGlassAmount"),
      uLightning: gl.getUniformLocation(prog, "uLightning"),
    };

    gl.useProgram(prog);
    gl.uniform1f(uni.uPhase, PHASE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const resizeCanvas = (chip: number) => {
      const view = viewSize(chip);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.max(1, Math.round(view * dpr));
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      canvas.style.width = `${view}px`;
      canvas.style.height = `${view}px`;
      gl.viewport(0, 0, px, px);
    };

    const onResize = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      const chip = settingsRef.current.size;
      const saved = settingsRef.current.position;
      if (saved && parked) {
        applyPositionRatios(saved);
      } else {
        clampToViewport(chip);
        applyRootTransform();
      }
      applyGlassOptions(settingsRef.current);
      resizeCanvas(chip);
    };
    window.addEventListener("resize", onResize);
    resizeCanvas(settingsRef.current.size);

    if (settingsRef.current.position) {
      applyPositionRatios(settingsRef.current.position);
    } else {
      applyRootTransform();
    }

    const tickPhysics = (dtMs: number, s: LiquidDropSettings) => {
      if (parked || drag.active) return;
      const view = viewSize(s.size);
      const maxX = Math.max(0, viewW - view);
      const maxY = Math.max(0, viewH - view);
      const target = 52 * s.speed;
      const cur = Math.hypot(state.vx, state.vy) || 1;
      state.vx = (state.vx / cur) * target;
      state.vy = (state.vy / cur) * target;
      const dt = dtMs / 1000;
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      if (state.x < 0) {
        state.x = 0;
        state.vx = Math.abs(state.vx);
      } else if (state.x > maxX) {
        state.x = maxX;
        state.vx = -Math.abs(state.vx);
      }
      if (state.y < 0) {
        state.y = 0;
        state.vy = Math.abs(state.vy);
      } else if (state.y > maxY) {
        state.y = maxY;
        state.vy = -Math.abs(state.vy);
      }
    };

    let lastSize = settingsRef.current.size;
    let lastGlassKey = "";

    const onMove = (e: PointerEvent) => {
      if (!drag.active) return;
      e.preventDefault();
      state.x = e.clientX - drag.ox;
      state.y = e.clientY - drag.oy;
      clampToViewport(settingsRef.current.size);
      applyRootTransform();
    };

    const endDrag = (e: PointerEvent) => {
      if (!drag.active) return;
      drag.active = false;
      handle.classList.remove("is-dragging");
      document.documentElement.classList.remove("bh-dragging");
      clampToViewport(settingsRef.current.size);
      applyRootTransform();
      savePosition();
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      updateHoverState(e.clientX, e.clientY, e.target);
    };

    const beginDrag = (e: PointerEvent) => {
      drag.active = true;
      drag.ox = e.clientX - state.x;
      drag.oy = e.clientY - state.y;
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

    const updateHoverState = (
      clientX: number,
      clientY: number,
      target: EventTarget | null
    ) => {
      if (drag.active) return;
      const hot = isDropHotspot(clientX, clientY) && !isSiteChrome(target);
      handle.classList.toggle("is-hot", hot);
      document.documentElement.classList.toggle("bh-grab-hover", hot);
      handle.style.pointerEvents = hot ? "auto" : "none";
    };

    const onHoverMove = (e: PointerEvent) => {
      if (drag.active) return;
      updateHoverState(e.clientX, e.clientY, e.target);
    };

    const onDownCapture = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (drag.active) return;
      if (isSiteChrome(e.target)) return;
      if (!isDropHotspot(e.clientX, e.clientY)) return;
      e.preventDefault();
      e.stopPropagation();
      beginDrag(e);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (drag.active) return;
      if (!isDropHotspot(e.clientX, e.clientY)) return;
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

    const frame = (now: number) => {
      if (cancelled) return;
      const s = settingsRef.current;
      root.style.display = s.enabled ? "" : "none";
      handle.style.display = s.enabled ? "" : "none";
      if (!s.enabled) {
        lastTs = now;
        acc = 0;
        raf = requestAnimationFrame(frame);
        return;
      }

      const posKey = s.position
        ? `${s.position.xRatio}:${s.position.yRatio}`
        : "";
      if (posKey !== lastPosKey) {
        lastPosKey = posKey;
        if (s.position) {
          applyPositionRatios(s.position);
        } else if (!drag.active) {
          parked = false;
          Object.assign(state, randomVelocity(s.speed));
        }
      }

      const dt = Math.min(MAX_FRAME_MS, now - lastTs);
      lastTs = now;
      acc += dt;
      while (acc >= PHYSICS_STEP_MS) {
        tickPhysics(PHYSICS_STEP_MS, s);
        acc -= PHYSICS_STEP_MS;
      }

      if (!drag.active) applyRootTransform();

      if (s.size !== lastSize) {
        lastSize = s.size;
        applyGlassOptions(s);
        resizeCanvas(s.size);
        clampToViewport(s.size);
        applyRootTransform();
      }

      const glassKey = [
        s.strength,
        s.depth,
        s.chromaticAberration,
        s.blur,
        s.brightness,
      ].join(":");
      if (glassKey !== lastGlassKey) {
        lastGlassKey = glassKey;
        applyGlassOptions(s);
      }

      const chip = s.size;
      const view = viewSize(chip);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uni.uTime, now * 0.001);
      gl.uniform1f(uni.uIsLight, themeRef.current === "light" ? 1 : 0);
      gl.uniform1f(uni.uChipPx, chip);
      gl.uniform1f(uni.uViewPx, view);
      gl.uniform1f(uni.uBoltWidthTune, s.boltWidth);
      gl.uniform1f(uni.uBoltIntensity, s.boltIntensity);
      gl.uniform1f(uni.uGlassAmount, 1);
      gl.uniform1f(uni.uLightning, s.lightning ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

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
      glassFx?.destroy();
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <>
      <div ref={rootRef} className="liquidDropRoot" aria-hidden="true">
        <div ref={glassRef} className="liquidDropGlass" />
        <canvas ref={canvasRef} className="liquidDropCanvas" />
        <div
          ref={handleRef}
          className="liquidDropDragHandle"
          aria-label="Drag liquid glass"
          title="Drag"
        />
      </div>
    </>
  );
}
