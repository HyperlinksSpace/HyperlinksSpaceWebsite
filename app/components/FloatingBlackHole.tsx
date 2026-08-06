"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_BLACK_HOLE,
  useBlackHole,
  type BlackHolePosition,
  type BlackHoleSettings,
} from "./BlackHoleContext";

/**
 * Small binary BH + screen-wide lensing.
 * Full-viewport canvas is click-through.
 * Drag uses a core/disk hotspot: grab cursor + drag there; elsewhere clicks pass to
 * Strategy / stickers / links underneath.
 */

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_res;
uniform vec2 u_anchor; // screen center of binary in aspect-corrected uv (-aspect..aspect, -1..1)
uniform float u_time;
uniform float u_binary;
uniform float u_sep;
uniform float u_persp;
uniform float u_glow;
uniform float u_speed;
uniform float u_sky;
uniform float u_orbit;
uniform float u_scale;
uniform float u_quality;
uniform float u_light;
uniform float u_mobile; // 1 on phones — larger cores + stronger field
uniform vec4 u_bh1;
uniform vec4 u_bh2;
uniform float u_hue1;
uniform float u_hue2;
uniform sampler2D u_noise;

#define PI 3.14159265
#define MAX_STEPS 72

float ls(float x) { return abs(mod(x, 2.0) - 1.0); }
float lsa(float x) { return abs(mod(x / PI, 2.0) - 1.0) * 2.0 - 1.0; }

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  return texture(u_noise, p / 96.0).r * 0.65
       + texture(u_noise, p / 32.0).r * 0.35;
}

vec3 diskThermal(float t, float a, float dpl, float time) {
  // Light: broader luminous band so colored disk reads thicker
  float hvDark = pow(max(t * t * (1.0 - t) * 6.75, 1e-6), 0.25);
  float hvLight = pow(max(t * (0.35 + 0.65 * t) * (1.15 - 0.45 * t) * 3.4, 1e-6), 0.32);
  float hv = mix(hvDark, hvLight, u_light);
  float n = noise(vec2((t - time * 0.01) * 20.0, lsa(a + time) * 3.0)) * 2.0 - 1.0;
  float t_noise = clamp(t * (1.0 - n) + n, 0.0, 1.0);
  float d_factor = -dpl * 0.1 + 1.05;
  float t_adjusted = t_noise * 1.5 / (t_noise * d_factor + 0.5) * hv;
  float t_factor = t_adjusted * 0.5 + 0.5 * hv;
  float t_half = t_adjusted * 0.5 + 0.4 * hv;
  float t_pow5 = exp(5.0 * log(max(t_adjusted, 1e-5)));
  float t_pow20 = exp(20.0 * log(max(t_adjusted, 1e-5)));
  vec3 acol = vec3(t_half, t_pow5 * 0.6, t_pow20 * 0.3) * t_factor;
  vec3 dcol = (1.0 - acol) * max(dpl, 0.0) * t_noise * hv *
    pow(ls(t * 2.0 + 0.5), 4.0) * vec3(0.5, 0.6, 0.4);
  vec3 hot = acol + dcol;
  // Outer disk (low t): black hole → black; white hole → white only at outermost fringe
  vec3 darkRim = vec3(t, 0.0, 0.0);
  vec3 lightRim = vec3(1.0, 0.99, 0.98);
  vec3 rim = mix(darkRim, lightRim, u_light);
  float rimMix = clamp(1.0 - t, 0.0, 1.0);
  // Light: bleach only the extreme outer fringe — preserve a thick colored body
  rimMix = mix(rimMix, pow(smoothstep(0.88, 1.0, rimMix), 1.6), u_light);
  return clamp(mix(hot, rim, rimMix) * mix(1.4, 1.65, u_light), 0.0, 1.0);
}

vec3 tintDisk(vec3 thermal, float hueDeg) {
  float h = mod(hueDeg, 360.0);
  float cool = smoothstep(70.0, 130.0, h) * (1.0 - smoothstep(245.0, 305.0, h));
  vec3 cold = clamp(thermal.zyx * vec3(0.5, 0.7, 1.4) + thermal.x * vec3(0.12, 0.32, 0.95), 0.0, 1.0);
  return mix(thermal, cold, cool);
}

vec3 sky(vec3 rd) {
  if (u_sky <= 0.001) return vec3(0.0);
  vec3 d = normalize(rd);
  float lat = d.y;
  float lon = atan(d.z, d.x);
  float band = exp(-pow((lat - 0.06 * sin(lon * 2.4 + u_time * 0.15)) * 3.0, 2.0));
  vec3 dustDark = vec3(0.02, 0.025, 0.045) + vec3(0.08, 0.05, 0.03) * band;
  // Light theme: bright pearl haze (dark haze reads as dirty rims on white)
  vec3 dustLight = vec3(0.93, 0.96, 1.0) * (0.14 + 0.22 * band);
  vec3 dust = mix(dustDark, dustLight, u_light);
  float n = texture(u_noise, vec2(lon, lat) * 0.4 + u_time * 0.01).r - 0.2;
  dust += mix(vec3(0.03, 0.035, 0.06) * n, vec3(0.12, 0.14, 0.18) * max(n, 0.0), u_light);

  vec2 sp = vec2(lon, lat) * 110.0;
  vec2 g = floor(sp);
  float h = hash21(g);
  vec2 p = g + vec2(hash21(g + 17.1), hash21(g + 91.7));
  float star = pow(h, 15.0) * smoothstep(0.05, 0.0, length(sp - p));
  vec3 starDark = vec3(0.9, 0.93, 1.0);
  vec3 starLight = vec3(0.55, 0.7, 0.95);
  vec3 starCol = mix(starDark, starLight, u_light);
  return (dust * (0.4 + band * 1.15) + starCol * star * mix(1.6, 1.15, u_light)) * u_sky;
}

vec3 bendResidual(vec3 ro, vec3 rd, vec3 p, float rs) {
  vec3 w = ro - p;
  float s = dot(w, rd);
  vec3 wp = w - rd * s;
  float b = max(length(wp), rs);
  float r = sqrt(b * b + s * s);
  float a = (rs / b) * (1.0 - s / max(r, 1.0));
  return normalize(rd - (wp / b) * a);
}

vec3 skyFar(vec3 ro, vec3 rd, vec3 p1, float r1, vec3 p2, float r2, float binary) {
  rd = bendResidual(ro, rd, p1, r1);
  if (binary > 0.5) rd = bendResidual(ro, rd, p2, r2);
  return sky(rd);
}

vec3 bend(vec3 ro, vec3 rd, vec3 p, float rs, vec3 axis, float spin) {
  vec3 r = ro - p;
  float r2 = max(dot(r, r), 1e-8);
  float r1 = inversesqrt(r2);
  vec3 L = cross(r, rd);
  return -1.5 * rs * (r * dot(L, L)) * (r1 / (r2 * r2))
       + cross(axis, r) * spin * rs * 2.6 * r1 / r2;
}

void advance(
  inout vec3 o, inout vec3 d, float h,
  vec3 p1, float r1, vec3 a1, float s1,
  vec3 p2, float r2, vec3 a2, float s2,
  float binary
) {
  vec3 aA = bend(o, d, p1, r1, a1, s1);
  if (binary > 0.5) aA += bend(o, d, p2, r2, a2, s2);
  vec3 dm = normalize(d + aA * (h * 0.5));
  vec3 om = o + dm * (h * 0.5);
  vec3 aB = bend(om, dm, p1, r1, a1, s1);
  if (binary > 0.5) aB += bend(om, dm, p2, r2, a2, s2);
  d = normalize(d + aB * h);
  o += d * h;
}

bool hitDisk(
  vec3 oro, vec3 ro, vec3 rd,
  vec3 center, vec3 axis, vec3 u, vec3 v,
  float innerR, float outerR, float angleOffset,
  float hue, float time, inout vec3 col
) {
  float s1 = dot(oro - center, axis);
  float s2 = dot(ro - center, axis);
  // Light: fat vertical slab so edge-on disks read as bands, not hairlines
  float halfT = (innerR + outerR) * 0.07 * u_light;
  float tHit;
  if (s1 * s2 < 0.0) {
    tHit = s1 / (s1 - s2);
  } else if (halfT > 1e-5 && min(abs(s1), abs(s2)) < halfT) {
    float ds = s2 - s1;
    tHit = abs(ds) < 1e-6 ? 0.5 : clamp(-s1 / ds, 0.0, 1.0);
  } else {
    return false;
  }
  if (tHit < 0.0 || tHit > 1.0) return false;
  vec3 p = mix(oro, ro, tHit);
  vec3 rel = p - center;
  float hAbs = abs(dot(rel, axis));
  if (halfT > 1e-5 && hAbs > halfT) return false;
  vec3 radial = rel - axis * dot(rel, axis);
  float r = length(radial);
  // Soft radial skirts on light — widen the colorful annulus
  float rPad = (outerR - innerR) * 0.12 * u_light;
  if (r < innerR - rPad * 0.35 || r > outerR + rPad) return false;
  float x = dot(radial, u);
  float y = dot(radial, v);
  float angle = atan(y, x) + angleOffset;
  float span = max(outerR - innerR, 1e-5);
  float temp = 1.0 - clamp((r - innerR) / span, 0.0, 1.0);
  // Keep more of the radial width in the hot/colored zone on light
  temp = mix(temp, pow(clamp(temp, 0.0, 1.0), 0.55), u_light);
  vec3 rl = normalize(radial);
  vec3 tg = normalize(cross(axis, rl));
  float dop = dot(tg, rd);
  col = tintDisk(diskThermal(temp, angle, -dop, time), hue);
  if (u_light > 0.5) {
    float vf = 1.0 - smoothstep(halfT * 0.25, halfT, hAbs);
    float rf = 1.0;
    if (r < innerR) rf = smoothstep(innerR - rPad * 0.35, innerR, r);
    else if (r > outerR) rf = 1.0 - smoothstep(outerR, outerR + rPad, r);
    float gate = max(vf * rf, 0.0);
    col *= 0.65 + 0.35 * gate;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 1.7);
    col = clamp(col * 1.25, 0.0, 1.0);
  }
  return true;
}

vec2 project(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float fov) {
  vec3 to = p - ro;
  float z = max(dot(to, ww), 0.05);
  return vec2(dot(to, uu), dot(to, vv)) / (z * fov);
}

vec4 trace(
  vec3 ro, vec3 rd,
  vec3 p1, float r1, float s1, float i1, float o1, float hue1, vec3 a1, vec3 u1, vec3 v1,
  vec3 p2, float r2, float s2, float i2, float o2, float hue2, vec3 a2, vec3 u2, vec3 v2,
  float binary, float time, int limit
) {
  float C1 = r1 * 1.5;
  float C2 = r2 * 1.5;
  vec3 acc = vec3(0.0);

  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= limit) break;
    float d1 = length(ro - p1);
    float d2 = binary > 0.5 ? length(ro - p2) : 1e9;

    if (d1 < C1 || d2 < C2) {
      // Opaque horizon: black void / bright white-hole core
      vec3 core = mix(vec3(0.0), vec3(1.0, 1.0, 1.0), u_light);
      return vec4(core, 1.0);
    }

    if (d1 > 110.0 && d2 > 110.0) {
      vec3 far = skyFar(ro, rd, p1, r1, p2, r2, binary);
      acc += far;
      if (u_light > 0.5) {
        float a = clamp(max(max(acc.r, acc.g), acc.b) * 0.45, 0.0, 0.22);
        return vec4(vec3(0.97, 0.985, 1.0) * a, a);
      }
      float a = clamp(max(max(acc.r, acc.g), acc.b) * 1.05, 0.0, 0.55);
      return vec4(acc, a);
    }

    vec3 oro = ro;
    float h1 = d1 / (3.0 * r1);
    float h2 = d2 / (3.0 * max(r2, 1e-4));
    float h = (h1 * h2) / (h1 + h2);
    h = clamp(h, 0.02, 2.8);
    advance(ro, rd, h, p1, r1, a1, s1, p2, r2, a2, s2, binary);

    vec3 c;
    if (hitDisk(oro, ro, rd, p1, a1, u1, v1, i1, o1, 0.0, hue1, time, c)) {
      acc += c;
      return vec4(clamp(acc, 0.0, 1.0), 1.0);
    }
    if (binary > 0.5 && hitDisk(oro, ro, rd, p2, a2, u2, v2, i2, o2, -1.5, hue2, time, c)) {
      acc += c;
      return vec4(clamp(acc, 0.0, 1.0), 1.0);
    }
  }

  vec3 far = skyFar(ro, rd, p1, r1, p2, r2, binary);
  acc += far;
  if (u_light > 0.5) {
    float a = clamp(max(max(acc.r, acc.g), acc.b) * 0.4, 0.0, 0.2);
    return vec4(vec3(0.97, 0.985, 1.0) * a, a);
  }
  float a = clamp(max(max(acc.r, acc.g), acc.b) * 1.0, 0.0, 0.5);
  return vec4(acc, a);
}

void main() {
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 uv = (v_uv - 0.5) * 2.0;
  uv.x *= aspect;
  // BH follows drag handle across the screen
  uv -= u_anchor;

  float time = u_time * u_speed;
  // Larger cores — ~2–3× floating sticker height at default size
  float scale = clamp(u_scale * mix(1.0, 1.25, u_mobile), 0.6, 6.5);

  float R1 = mix(0.85, 1.7, clamp((u_bh1.x - 0.08) / 0.34, 0.0, 1.0));
  float R2 = mix(0.65, 1.35, clamp((u_bh2.x - 0.08) / 0.34, 0.0, 1.0));
  float sep = mix(4.5, 9.5, clamp((u_sep - 0.35) / 0.8, 0.0, 1.0));
  // Living orbit — breathe separation
  sep *= 0.88 + 0.14 * sin(time * 0.37);
  if (u_binary < 0.5) {
    sep = 0.0;
    R1 = max(R1, 1.2);
  }

  float ang = time * u_orbit;
  float ca = cos(ang);
  float sa = sin(ang);
  vec3 P1 = vec3(ca * (-sep * 0.5), 0.12 * sin(time * 0.55), sa * (-sep * 0.5));
  vec3 P2 = vec3(ca * ( sep * 0.5), -0.1 * sin(time * 0.61 + 0.7), sa * ( sep * 0.5));

  float I1 = R1 * max(u_bh1.z, 1.35) * mix(1.0, 0.72, u_light);
  float O1 = R1 * max(u_bh1.w, I1 / R1 + 1.1) * mix(1.0, 1.65, u_light);
  float I2 = R2 * max(u_bh2.z, 1.35) * mix(1.0, 0.72, u_light);
  float O2 = R2 * max(u_bh2.w, I2 / R2 + 1.1) * mix(1.0, 1.65, u_light);
  float S1 = clamp(u_bh1.y, -1.8, 1.8);
  float S2 = clamp(u_bh2.y, -1.8, 1.8);

  float pre = time * 0.14;
  vec3 A1 = normalize(vec3(0.14 * cos(pre), 0.96, 0.16 * sin(pre * 1.3)));
  vec3 A2 = normalize(vec3(-0.12 * cos(pre * 1.2), 0.97, -0.14 * sin(pre * 1.15)));
  vec3 U1 = normalize(cross(A1, vec3(0.0, 0.0, 1.0)));
  vec3 V1 = cross(A1, U1);
  vec3 U2 = normalize(cross(A2, vec3(0.0, 0.0, 1.0)));
  vec3 V2 = cross(A2, U2);

  float camDist = mix(58.0, 34.0, clamp((u_persp - 0.7) / 1.3, 0.0, 1.0));
  vec3 ro = vec3(0.0, camDist * 0.05, camDist);
  vec3 ww = normalize(-ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  float fov = 0.95 / scale;
  vec3 rd = normalize(uu * uv.x * fov + vv * uv.y * fov + ww);

  vec2 s1 = project(P1, ro, uu, vv, ww, fov);
  vec2 s2 = project(P2, ro, uu, vv, ww, fov);
  float dNear = length(uv - s1);
  if (u_binary > 0.5) dNear = min(dNear, length(uv - s2));
  // Geometric disk + orbit, with headroom for lensing magnification
  float diskSpan = (max(O1, O2) + sep * 0.55) / max(camDist * fov, 1.0);
  // Tighter LOD radii — large disks were ray-marching most of the viewport
  float nearR = diskSpan * 2.6;
  float farR = diskSpan * 4.0;

  int limit = int(mix(36.0, float(MAX_STEPS), u_quality));
  if (dNear > diskSpan * 1.35) limit = int(float(limit) * 0.5);
  if (dNear > diskSpan * 2.4) limit = max(12, int(float(limit) * 0.28));

  vec4 hit = vec4(0.0);
  if (dNear < farR) {
    hit = trace(
      ro, rd,
      P1, R1, S1, I1, O1, u_hue1, A1, U1, V1,
      P2, R2, S2, I2, O2, u_hue2, A2, U2, V2,
      u_binary, time, limit
    );
  }

  vec4 farCol = vec4(0.0);
  float lod = smoothstep(farR, nearR, dNear);
  if (lod < 0.97 && u_light < 0.5) {
    vec3 far = skyFar(ro, rd, P1, R1, P2, R2, u_binary);
    float fall = exp(-dNear * mix(0.55, 0.38, u_mobile));
    float aMax = mix(0.28, 0.42, u_mobile);
    float farA = clamp(max(max(far.r, far.g), far.b) * mix(0.85, 1.15, u_mobile), 0.0, aMax) * fall;
    farA *= 0.55 + 0.45 * u_sky;
    farCol = vec4(far * farA, farA);
  } else if (lod < 0.97 && u_light > 0.5) {
    // Soft luminous halo — warm/cool tint, not flat grey veil
    float fall = exp(-dNear * mix(0.48, 0.32, u_mobile));
    float glowA = 0.18 * fall * (0.35 + 0.65 * u_sky);
    vec3 halo = mix(vec3(1.0, 0.72, 0.42), vec3(0.55, 0.75, 1.0), 0.45 + 0.25 * sin(u_time * 0.2));
    farCol = vec4(halo * glowA, glowA);
  }

  vec3 col = hit.rgb * mix(0.95, 1.55, clamp(u_glow, 0.4, 2.0) / 2.0);
  if (u_light > 0.5) {
    // Punch saturated disk color through the white stage
    col *= 1.75;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    float sat = length(col - vec3(l));
    col = mix(vec3(l), col, 1.85);
    col = clamp(col / (col * 0.06 + 0.94), 0.0, 1.0);
    // Bleach only achromatic charcoal — never eat chroma into white
    float dead = (1.0 - smoothstep(0.03, 0.18, l)) * (1.0 - smoothstep(0.02, 0.1, sat));
    col = mix(col, vec3(1.0), dead);
  } else {
    col = clamp(col / (col * 0.26 + 0.74), 0.0, 1.0);
  }
  float core = smoothstep(diskSpan * 2.0, diskSpan * 0.35, dNear);
  float nearA = hit.a * mix(mix(0.55, 0.7, u_mobile), 1.0, core);
  vec4 nearCol = vec4(col * nearA, nearA);

  fragColor = mix(farCol, nearCol, lod);

  // Soften against the viewport edge so glow never ends in a hard line
  vec2 edgeUV = abs(v_uv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.94, 1.0, max(edgeUV.x, edgeUV.y));
  fragColor.rgb *= mix(edgeFade, 1.0, core * lod);
  fragColor.a *= mix(edgeFade, 1.0, core * lod);

  // Light theme: drop only achromatic charcoal soft haze — keep vivid disk color
  if (u_light > 0.5) {
    float a = max(fragColor.a, 1e-5);
    vec3 np = fragColor.rgb / a;
    float npl = dot(np, vec3(0.299, 0.587, 0.114));
    float sat = length(np - vec3(npl));
    float soft = 1.0 - smoothstep(0.4, 0.92, a);
    float mud = soft
      * (1.0 - smoothstep(0.06, 0.28, npl))
      * (1.0 - smoothstep(0.03, 0.12, sat));
    a *= 1.0 - mud;
    fragColor = vec4(np * a, a);
  }
}`;

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

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fsSrc: string) {
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!fs) return null;
  const prog = gl.createProgram();
  if (!prog) {
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function makeNoiseTexture(gl: WebGL2RenderingContext) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = (Math.random() * 255) | 0;
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return tex;
}

function autoParams(base: BlackHoleSettings, t: number): BlackHoleSettings {
  return {
    ...base,
    separation: 0.58 + 0.28 * (0.5 + 0.5 * Math.sin(t * 0.19)),
    perspective: 0.95 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.11 + 0.8)),
    glow: 1.05 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.23 + 0.4)),
    sky: 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.09 + 1.7)),
    speed: base.speed,
    bh1: {
      ...base.bh1,
      radius: DEFAULT_BLACK_HOLE.bh1.radius,
      spin: 0.7 + 0.85 * Math.sin(t * 0.27),
      hue: (12 + 48 * (0.5 + 0.5 * Math.sin(t * 0.07))) % 360,
      diskInner: 1.5,
      diskOuter: 4.2 + 2.8 * (0.5 + 0.5 * Math.sin(t * 0.15 + 0.5)),
    },
    bh2: {
      ...base.bh2,
      radius: DEFAULT_BLACK_HOLE.bh2.radius,
      spin: -0.55 - 0.9 * Math.sin(t * 0.31 + 1.1),
      hue: (175 + 70 * (0.5 + 0.5 * Math.sin(t * 0.08 + 1.2))) % 360,
      diskInner: 1.5,
      diskOuter: 3.8 + 2.4 * (0.5 + 0.5 * Math.sin(t * 0.17 + 1.4)),
    },
  };
}

/** Screen-space half-extent of disks+cores incl. lensing headroom. */
function visualRadiusPx(
  s: BlackHoleSettings,
  viewH: number,
  mobile: boolean,
  scaleMul = 1
): number {
  // Worst-case extents while auto animates, so we never clip mid-orbit
  const sepSetting = s.mode === "auto" ? 0.86 : s.separation;
  const persp = s.mode === "auto" ? 1.3 : s.perspective;
  const diskOuter =
    s.mode === "auto"
      ? 7.0
      : Math.max(s.bh1.diskOuter, s.bh2.diskOuter);
  const bodyR =
    s.mode === "auto"
      ? DEFAULT_BLACK_HOLE.bh1.radius
      : Math.max(s.bh1.radius, s.bh2.radius);

  let scale = mobile
    ? 3.6 + ((s.size - 160) / 200) * 1.2
    : 3.2 + ((s.size - 160) / 200) * 1.4;
  scale = Math.min(6.5, Math.max(0.6, scale * (mobile ? 1.25 : 1) * scaleMul));

  const fov = 0.95 / scale;
  const camDist =
    58 - Math.min(1, Math.max(0, (persp - 0.7) / 1.3)) * 24;
  const R1 = 0.85 + Math.min(1, Math.max(0, (bodyR - 0.08) / 0.34)) * 0.85;
  const outer = R1 * Math.max(diskOuter, 2.5);
  const sep = s.binary
    ? (4.5 + Math.min(1, Math.max(0, (sepSetting - 0.35) / 0.8)) * 5) * 1.02
    : 0;
  // Match shader far blend radius so cores+lensed disks stay on-screen
  const diskSpan = (outer + sep * 0.55) / Math.max(camDist * fov, 1);
  return diskSpan * 5.0 * (viewH * 0.5);
}

/** Painted bounds of Strategy (object-fit: contain, top-left), not the tall hit box. */
function strategyPaintedRect(): {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
} | null {
  const el = document.querySelector(".siteStrategyOverlay");
  if (!el) return null;
  const img = el.querySelector("img");
  const box = (img ?? el).getBoundingClientRect();
  if (box.width < 8 || box.height < 8) return null;

  const natW =
    (img && img.naturalWidth > 0 ? img.naturalWidth : 0) ||
    Number(img?.getAttribute("width")) ||
    430;
  const natH =
    (img && img.naturalHeight > 0 ? img.naturalHeight : 0) ||
    Number(img?.getAttribute("height")) ||
    208;
  const natAR = natW / Math.max(1, natH);
  const boxAR = box.width / Math.max(1, box.height);

  let contentW: number;
  let contentH: number;
  if (boxAR > natAR) {
    contentH = box.height;
    contentW = contentH * natAR;
  } else {
    contentW = box.width;
    contentH = contentW / natAR;
  }

  return {
    left: box.left,
    top: box.top,
    width: contentW,
    height: contentH,
    right: box.left + contentW,
    bottom: box.top + contentH,
  };
}

type ViewRect = { left: number; top: number; w: number; h: number };

/** Free handle range that stays on-screen and clear of the opaque settings panel. */
function panelAwareHandleBounds(
  vis: ViewRect,
  hs: number,
  edgeMargin: number,
  panel: DOMRect | null,
  mobile: boolean
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = vis.left + edgeMargin - hs * 0.5;
  let maxX = vis.left + vis.w - edgeMargin - hs * 0.5;
  let minY = vis.top + edgeMargin - hs * 0.5;
  let maxY = vis.top + vis.h - edgeMargin - hs * 0.5;

  if (!panel || panel.width < 8 || panel.height < 8) {
    return { minX, maxX, minY, maxY };
  }

  // Keep cores out from under the dialog; glow may tuck slightly
  const pad = Math.max(28, Math.min(56, Math.min(vis.w, vis.h) * 0.05));
  const bottomSheet =
    mobile ||
    panel.top > vis.top + vis.h * 0.4 ||
    panel.bottom > vis.top + vis.h * 0.62;

  if (bottomSheet) {
    maxY = Math.min(maxY, panel.top - pad - hs * 0.5);
  } else {
    const rightMinX = panel.right + pad - hs * 0.5;
    const belowMinY = panel.bottom + pad - hs * 0.5;
    const rightSpan = maxX - Math.max(minX, rightMinX);
    const belowSpan = maxY - Math.max(minY, belowMinY);
    // Prefer the larger free region so BH never gets shoved off-screen
    if (rightSpan >= belowSpan && rightSpan > 48) {
      minX = Math.max(minX, rightMinX);
    } else if (belowSpan > 48) {
      minY = Math.max(minY, belowMinY);
    } else if (rightSpan > 0) {
      minX = Math.max(minX, rightMinX);
    } else if (belowSpan > 0) {
      minY = Math.max(minY, belowMinY);
    }
  }

  return { minX, maxX, minY, maxY };
}

function clampIntoBounds(
  x: number,
  y: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  vis: ViewRect,
  hs: number
): { x: number; y: number } {
  let { minX, maxX, minY, maxY } = bounds;
  if (minX > maxX) {
    const mid = vis.left + vis.w * 0.62 - hs * 0.5;
    minX = maxX = Math.max(
      vis.left + 8,
      Math.min(mid, vis.left + vis.w - hs - 8)
    );
  }
  if (minY > maxY) {
    const mid = vis.top + vis.h * 0.4 - hs * 0.5;
    minY = maxY = Math.max(
      vis.top + 8,
      Math.min(mid, vis.top + vis.h - hs - 8)
    );
  }
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

export default function FloatingBlackHole() {
  const { settings, setSettings, panelOpen } = useBlackHole();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  const repositionRef = useRef<(() => void) | null>(null);
  const posRef = useRef({
    x: 0,
    y: 0,
    ready: false,
    userPlaced: false,
    underStrategy: false,
  });
  const dragRef = useRef({ active: false, ox: 0, oy: 0 });

  useEffect(() => {
    repositionRef.current?.();
  }, [settings.position]);

  // When settings open, park BH in the largest clear on-screen region (never off-canvas)
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    if (!panelOpen) {
      repositionRef.current?.();
      return;
    }

    let cancelled = false;
    const park = () => {
      if (cancelled) return;
      const vv = window.visualViewport;
      const vis: ViewRect = {
        left: Math.floor(vv?.offsetLeft ?? 0),
        top: Math.floor(vv?.offsetTop ?? 0),
        w: Math.floor(vv?.width ?? window.innerWidth),
        h: Math.floor(vv?.height ?? window.innerHeight),
      };
      const hs = handle.offsetWidth || 56;
      const mobile =
        window.matchMedia("(pointer: coarse)").matches || vis.w <= 640;
      const softMargin = Math.min(
        Math.max(visualRadiusPx(settingsRef.current, vis.h, mobile) * 0.55, 48),
        Math.min(vis.w, vis.h) * 0.18
      );
      const panel = document.getElementById("bh-settings-panel");
      const pr = panel?.getBoundingClientRect() ?? null;
      const bounds = panelAwareHandleBounds(vis, hs, softMargin, pr, mobile);
      const preferredX = vis.left + vis.w * (mobile ? 0.5 : 0.64) - hs * 0.5;
      const preferredY = vis.top + vis.h * (mobile ? 0.3 : 0.48) - hs * 0.5;
      const next = clampIntoBounds(preferredX, preferredY, bounds, vis, hs);
      posRef.current.x = next.x;
      posRef.current.y = next.y;
      handle.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
    };

    // Wait for dialog layout so getBoundingClientRect is accurate
    const id = requestAnimationFrame(() => requestAnimationFrame(park));
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [panelOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const handle = handleRef.current;
    if (!canvas || !handle) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    if (!vs) return;
    const prog = link(gl, vs, FRAG);
    if (!prog) return;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(prog);

    const noiseTex = makeNoiseTexture(gl);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);

    const uni = {
      res: gl.getUniformLocation(prog, "u_res"),
      anchor: gl.getUniformLocation(prog, "u_anchor"),
      time: gl.getUniformLocation(prog, "u_time"),
      binary: gl.getUniformLocation(prog, "u_binary"),
      sep: gl.getUniformLocation(prog, "u_sep"),
      persp: gl.getUniformLocation(prog, "u_persp"),
      glow: gl.getUniformLocation(prog, "u_glow"),
      speed: gl.getUniformLocation(prog, "u_speed"),
      sky: gl.getUniformLocation(prog, "u_sky"),
      orbit: gl.getUniformLocation(prog, "u_orbit"),
      scale: gl.getUniformLocation(prog, "u_scale"),
      quality: gl.getUniformLocation(prog, "u_quality"),
      light: gl.getUniformLocation(prog, "u_light"),
      mobile: gl.getUniformLocation(prog, "u_mobile"),
      bh1: gl.getUniformLocation(prog, "u_bh1"),
      bh2: gl.getUniformLocation(prog, "u_bh2"),
      hue1: gl.getUniformLocation(prog, "u_hue1"),
      hue2: gl.getUniformLocation(prog, "u_hue2"),
      noise: gl.getUniformLocation(prog, "u_noise"),
    };
    gl.uniform1i(uni.noise, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const low =
      window.matchMedia("(pointer: coarse)").matches ||
      window.innerWidth <= 768 ||
      ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    const mobile =
      window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768;

    const isLightTheme = () =>
      document.documentElement.getAttribute("data-theme") === "light";

    let raf = 0;
    let start = performance.now();
    let pausedAt = 0;
    let visible = !document.hidden;
    let needsResize = true;
    let lightMode = isLightTheme() ? 1 : 0;
    let pausedDrawn = false;
    let lastW = 0;
    let lastH = 0;
    let lastCssW = 0;
    let lastCssH = 0;
    let fitMul = 1;
    let scaleDirty = true;
    let lastScaleKey = "";
    let cachedScale = 1;
    let placeTries = 0;
    let placeRetryAt = 0;
    let cachedHs = mobile ? 64 : 56;
    let lastDrawAt = 0;
    const targetFps = low ? 30 : 45;
    const minFrameMs = 1000 / targetFps;

    // Cover the full layout viewport so the canvas box never crops the effect
    const viewSize = () => ({
      w: Math.max(1, Math.floor(window.innerWidth)),
      h: Math.max(1, Math.floor(window.innerHeight)),
    });

    const visibleBounds = () => {
      const vv = window.visualViewport;
      return {
        left: vv?.offsetLeft ?? 0,
        top: vv?.offsetTop ?? 0,
        w: Math.max(1, Math.floor(vv?.width ?? window.innerWidth)),
        h: Math.max(1, Math.floor(vv?.height ?? window.innerHeight)),
      };
    };

    const applyHandleTransform = () => {
      handle.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
    };

    const applyPositionRatios = (pos: BlackHolePosition) => {
      const vis = visibleBounds();
      const hs = handleSize();
      posRef.current.x = vis.left + pos.xRatio * vis.w - hs * 0.5;
      posRef.current.y = vis.top + pos.yRatio * vis.h - hs * 0.5;
      clampHandle(1);
      applyHandleTransform();
      posRef.current.ready = true;
      posRef.current.userPlaced = true;
      posRef.current.underStrategy = true;
    };

    const savePosition = () => {
      const vis = visibleBounds();
      const hs = handleSize();
      const cx = posRef.current.x + hs * 0.5;
      const cy = posRef.current.y + hs * 0.5;
      const next: BlackHolePosition = {
        xRatio: Math.min(1, Math.max(0, (cx - vis.left) / vis.w)),
        yRatio: Math.min(1, Math.max(0, (cy - vis.top) / vis.h)),
      };
      posRef.current.userPlaced = true;
      posRef.current.underStrategy = true;
      setSettings((s) => ({ ...s, position: next }));
    };

    const syncCoreHandleSize = () => {
      const vis = visibleBounds();
      const s = settingsRef.current;
      const visR = visualRadiusPx(s, vis.h, mobile, fitMul);
      // Match core+disk footprint so hover tracks the visible holes, not just center
      const hotR = Math.max(
        40,
        Math.min(visR * 0.52, Math.min(vis.w, vis.h) * 0.24)
      );
      const corePx = Math.round(hotR * 2);
      const prev = cachedHs || corePx;
      if (Math.abs(corePx - prev) < 2 && handle.offsetWidth > 0) return;
      const cx = posRef.current.x + prev * 0.5;
      const cy = posRef.current.y + prev * 0.5;
      handle.style.width = `${corePx}px`;
      handle.style.height = `${corePx}px`;
      cachedHs = corePx;
      if (posRef.current.ready) {
        posRef.current.x = cx - corePx * 0.5;
        posRef.current.y = cy - corePx * 0.5;
        applyHandleTransform();
      }
    };

    const handleCenter = () => {
      const hs = handleSize();
      return {
        cx: posRef.current.x + hs * 0.5,
        cy: posRef.current.y + hs * 0.5,
      };
    };

    /** Opaque cores + bright disks — not the soft sky glow. */
    const isBhDragHotspot = (clientX: number, clientY: number) => {
      const { cx, cy } = handleCenter();
      const hs = handleSize();
      return Math.hypot(clientX - cx, clientY - cy) <= hs * 0.5;
    };

    const isSiteChrome = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          ".bhSettingsWrapper, .themeSwitchWrapper, .langSwitchWrapper, .bhSettingsPanel, #bh-settings-panel"
        )
      );
    };

    const handleSize = () => {
      const w = handle.offsetWidth;
      if (w > 0) cachedHs = w;
      return cachedHs;
    };

    /** Keep binary center inset so disks never hit the viewport edge. */
    const clampHandle = (scaleMul = 1) => {
      const vis = visibleBounds();
      const hs = handleSize();
      const s = settingsRef.current;
      const minDim = Math.min(vis.w, vis.h);
      const sizeCap = Math.min(minDim * 0.48, Math.max(220, minDim * 0.42));
      const maxMarginX = Math.max(24, vis.w * 0.24);
      const maxMarginY = Math.max(28, vis.h * 0.34);
      let fit = scaleMul;
      for (let i = 0; i < 6; i++) {
        const raw = visualRadiusPx(s, vis.h, mobile, fit);
        const need = Math.max(raw / sizeCap, raw / maxMarginX, raw / maxMarginY, 1);
        if (need <= 1.001) break;
        fit = Math.max(0.45, fit / need);
      }
      fitMul = fit;
      const margin = Math.min(
        Math.max(visualRadiusPx(s, vis.h, mobile, fit), minDim * 0.1 * fit),
        sizeCap,
        maxMarginX,
        maxMarginY
      );

      let maxY = vis.top + vis.h - margin - hs * 0.5;
      let minX = vis.left + margin - hs * 0.5;
      let maxX = vis.left + vis.w - margin - hs * 0.5;
      let minY = vis.top + margin - hs * 0.5;

      if (panelOpenRef.current) {
        const panel = document.getElementById("bh-settings-panel");
        const pr = panel?.getBoundingClientRect() ?? null;
        // Softer edge margin while panel is open so BH still fits beside it
        const softMargin = Math.min(margin * 0.62, Math.min(vis.w, vis.h) * 0.16);
        minX = vis.left + softMargin - hs * 0.5;
        maxX = vis.left + vis.w - softMargin - hs * 0.5;
        minY = vis.top + softMargin - hs * 0.5;
        maxY = vis.top + vis.h - softMargin - hs * 0.5;
        const b = panelAwareHandleBounds(vis, hs, softMargin, pr, mobile);
        minX = b.minX;
        maxX = b.maxX;
        minY = b.minY;
        maxY = b.maxY;
      }

      const leftBias = vis.left + vis.w * (mobile ? 0.22 : 0.2) - hs * 0.5;
      let x = posRef.current.x;
      let y = posRef.current.y;
      if (panelOpenRef.current) {
        const next = clampIntoBounds(x, y, { minX, maxX, minY, maxY }, vis, hs);
        x = next.x;
        y = next.y;
      } else if (minX > maxX) {
        x = Math.max(vis.left + 4, Math.min(leftBias, vis.left + vis.w - hs - 4));
      } else {
        x = Math.max(minX, Math.min(maxX, x));
      }
      if (!panelOpenRef.current) {
        if (minY > maxY) {
          y = Math.max(
            vis.top + 4,
            Math.min(maxY, vis.top + vis.h * 0.55 - hs * 0.5)
          );
        } else {
          y = Math.max(minY, Math.min(maxY, y));
        }
      }

      if (x !== posRef.current.x || y !== posRef.current.y) {
        posRef.current.x = x;
        posRef.current.y = y;
        applyHandleTransform();
      }
      return fitMul;
    };

    const recomputeScale = () => {
      const s = settingsRef.current;
      clampHandle(1);
      cachedScale =
        (mobile
          ? 3.6 + ((s.size - 160) / 200) * 1.2
          : 3.2 + ((s.size - 160) / 200) * 1.4) * fitMul;
      lastScaleKey = `${s.size}|${s.binary ? 1 : 0}|${s.mode}|${mobile ? 1 : 0}`;
      scaleDirty = false;
    };

    const placeHandleDefault = () => {
      if (posRef.current.userPlaced) return;
      if (settingsRef.current.position) {
        applyPositionRatios(settingsRef.current.position);
        return;
      }
      if (posRef.current.underStrategy) return;

      const vis = visibleBounds();
      const hs = handleSize();
      const content = strategyPaintedRect();

      if (!content) {
        placeTries += 1;
        if (!posRef.current.ready) {
          const topPad = mobile ? 130 : 144;
          posRef.current.x = vis.left + vis.w * (mobile ? 0.2 : 0.18) - hs * 0.5;
          posRef.current.y =
            vis.top + topPad + Math.min(220, vis.h * 0.28) - hs * 0.5;
          applyHandleTransform();
          posRef.current.ready = true;
        }
        // Stop hammering layout after ~1.5s — lock provisional spot
        if (placeTries > 90) {
          posRef.current.underStrategy = true;
          scaleDirty = true;
        }
        return;
      }

      const gap = mobile ? 18 : 28;
      const clearance = mobile ? 56 : 72;
      const cx = content.left + content.width * 0.5;
      let cy = content.bottom + gap + clearance;
      cy = Math.min(cy, vis.top + vis.h * 0.78);
      cy = Math.max(cy, content.bottom + gap + clearance * 0.85);

      posRef.current.x = cx - hs * 0.5;
      posRef.current.y = cy - hs * 0.5;
      posRef.current.ready = true;
      posRef.current.underStrategy = true;
      clampHandle(1);
      applyHandleTransform();
      scaleDirty = true;
    };

    const resize = () => {
      const { w: cssW, h: cssH } = viewSize();
      // Fixed DPR budget — no adaptive thrashing
      const dprCap = low ? 1 : 1.15;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      let w = Math.max(1, Math.floor(cssW * dpr));
      let h = Math.max(1, Math.floor(cssH * dpr));
      const maxPix = low ? 0.65e6 : 1.1e6;
      if (w * h > maxPix) {
        const s = Math.sqrt(maxPix / (w * h));
        w = Math.max(1, Math.floor(w * s));
        h = Math.max(1, Math.floor(h * s));
      }
      if (w !== lastW || h !== lastH) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        lastW = w;
        lastH = h;
      }
      canvas.style.top = "0px";
      canvas.style.left = "0px";
      canvas.style.right = "auto";
      canvas.style.bottom = "auto";
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      needsResize = false;
      pausedDrawn = false;
      if (
        (cssW !== lastCssW || cssH !== lastCssH) &&
        !dragRef.current.active
      ) {
        if (settingsRef.current.position) {
          applyPositionRatios(settingsRef.current.position);
        } else if (!posRef.current.userPlaced) {
          posRef.current.underStrategy = false;
          placeTries = 0;
        }
      }
      lastCssW = cssW;
      lastCssH = cssH;
      placeHandleDefault();
      scaleDirty = true;
    };

    const anchorFromPos = () => {
      const { w, h } = viewSize();
      const hs = cachedHs;
      const cx = posRef.current.x + hs * 0.5;
      const cy = posRef.current.y + hs * 0.5;
      const aspect = w / Math.max(h, 1);
      const nx = ((cx / w) * 2 - 1) * aspect;
      const ny = -((cy / h) * 2 - 1);
      return [nx, ny] as const;
    };

    let resizeTimer = 0;
    const onResize = () => {
      // Debounce visualViewport spam (mobile URL bar)
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        needsResize = true;
      }, 80);
    };
    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("scroll", onResize, { passive: true });

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const base = settingsRef.current;
      if (!visible || !base.enabled) return;

      if (now - lastDrawAt < minFrameMs) return;
      lastDrawAt = now;

      if (needsResize) resize();
      else if (
        !posRef.current.userPlaced &&
        !posRef.current.underStrategy &&
        now >= placeRetryAt
      ) {
        placeHandleDefault();
        placeRetryAt = now + 80;
      }

      let t = (now - start) / 1000;
      if (!base.play) {
        if (!pausedAt) pausedAt = t;
        t = pausedAt;
        if (pausedDrawn) return;
      } else if (pausedAt) {
        start = now - pausedAt * 1000;
        pausedAt = 0;
        t = (now - start) / 1000;
        pausedDrawn = false;
      }

      const s = base.mode === "auto" ? autoParams(base, t) : base;
      const scaleKey = `${s.size}|${s.binary ? 1 : 0}|${s.mode}|${mobile ? 1 : 0}`;
      if (
        scaleDirty ||
        scaleKey !== lastScaleKey ||
        (panelOpenRef.current && !dragRef.current.active)
      ) {
        recomputeScale();
        syncCoreHandleSize();
      }
      const scale = cachedScale;
      const [ax, ay] = anchorFromPos();

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uni.res, canvas.width, canvas.height);
      gl.uniform2f(uni.anchor, ax, ay);
      gl.uniform1f(uni.time, t);
      gl.uniform1f(uni.binary, s.binary ? 1 : 0);
      gl.uniform1f(uni.sep, s.separation);
      gl.uniform1f(uni.persp, s.perspective);
      gl.uniform1f(uni.glow, s.glow);
      gl.uniform1f(uni.speed, s.speed);
      gl.uniform1f(uni.sky, s.sky);
      gl.uniform1f(uni.orbit, s.mode === "auto" ? 0.22 : 0.14);
      gl.uniform1f(uni.scale, scale);
      gl.uniform1f(uni.quality, low ? 0.62 : 0.82);
      gl.uniform1f(uni.light, lightMode);
      gl.uniform1f(uni.mobile, mobile ? 1 : 0);
      gl.uniform4f(uni.bh1, s.bh1.radius, s.bh1.spin, s.bh1.diskInner, s.bh1.diskOuter);
      gl.uniform4f(uni.bh2, s.bh2.radius, s.bh2.spin, s.bh2.diskInner, s.bh2.diskOuter);
      gl.uniform1f(uni.hue1, s.bh1.hue);
      gl.uniform1f(uni.hue2, s.bh2.hue);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!base.play) pausedDrawn = true;
    };

    const applySavedOrDefault = () => {
      const saved = settingsRef.current.position;
      if (saved) {
        applyPositionRatios(saved);
        return;
      }
      posRef.current.userPlaced = false;
      posRef.current.underStrategy = false;
      placeTries = 0;
      placeHandleDefault();
    };
    repositionRef.current = applySavedOrDefault;

    applySavedOrDefault();
    resize();
    syncCoreHandleSize();
    raf = requestAnimationFrame(draw);

    const onVis = () => {
      visible = !document.hidden;
      if (visible) pausedDrawn = false;
    };
    document.addEventListener("visibilitychange", onVis);

    const themeMo = new MutationObserver(() => {
      const next = isLightTheme() ? 1 : 0;
      if (next !== lightMode) {
        lightMode = next;
        pausedDrawn = false;
      }
    });
    themeMo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      e.preventDefault();
      posRef.current.x = e.clientX - dragRef.current.ox;
      posRef.current.y = e.clientY - dragRef.current.oy;
      applyHandleTransform();
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      handle.classList.remove("is-dragging");
      document.documentElement.classList.remove("bh-dragging");
      clampHandle(1);
      syncCoreHandleSize();
      applyHandleTransform();
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
      dragRef.current.active = true;
      dragRef.current.ox = e.clientX - posRef.current.x;
      dragRef.current.oy = e.clientY - posRef.current.y;
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
      if (dragRef.current.active) return;
      const hot = isBhDragHotspot(clientX, clientY) && !isSiteChrome(target);
      handle.classList.toggle("is-hot", hot);
      document.documentElement.classList.toggle("bh-grab-hover", hot);
      // Hot: sit above overlays so cores are grab/draggable. Cold: fully click-through.
      handle.style.pointerEvents = hot ? "auto" : "none";
      handle.style.zIndex = hot ? "2147483000" : "22";
    };

    const onHoverMove = (e: PointerEvent) => {
      if (dragRef.current.active) return;
      updateHoverState(e.clientX, e.clientY, e.target);
    };

    const onDownCapture = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (dragRef.current.active) return;
      if (isSiteChrome(e.target)) return;
      if (!isBhDragHotspot(e.clientX, e.clientY)) return;
      // Core/disk zone → BH drag; outside stays available to Strategy / stickers / links
      e.preventDefault();
      e.stopPropagation();
      beginDrag(e);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (dragRef.current.active) return;
      if (!isBhDragHotspot(e.clientX, e.clientY)) return;
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

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
      document.removeEventListener("visibilitychange", onVis);
      themeMo.disconnect();
      if (!reducedMotion) {
        handle.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onHoverMove);
        window.removeEventListener("pointerdown", onDownCapture, true);
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      document.documentElement.classList.remove("bh-grab-hover", "bh-dragging");
      gl.deleteTexture(noiseTex);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteBuffer(buf);
    };
  }, []);

  if (!settings.enabled) return null;

  return (
    <>
      <canvas ref={canvasRef} className="floatingBlackHoleCanvas" aria-hidden="true" />
      <div
        ref={handleRef}
        className="bhDragHandle"
        aria-label="Drag black holes"
        title="Drag"
      />
    </>
  );
}
