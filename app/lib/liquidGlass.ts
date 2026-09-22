/**
 * Liquid glass via CSS backdrop-filter + SVG displacement maps.
 * Adapted from https://github.com/nxrix/liquid-glass (MIT).
 * Animate with transform (not width/height) so the map is not rebuilt every frame.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const NO_SVG_BACKDROP =
  /iP(hone|ad|od)|Macintosh/.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  ) &&
  !/Chrome\/|Chromium|Edg\//.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

export type LiquidGlassOptions = {
  strength: number;
  depth: number;
  chromaticAberration: number;
  blur: number;
  brightness: number;
  /** Border radius in px; null uses the element's CSS radius. */
  radius: number | null;
};

const DEFAULTS: LiquidGlassOptions = {
  strength: 64,
  depth: 8,
  chromaticAberration: 3,
  blur: 1,
  brightness: 0.9,
  radius: null,
};

export class LiquidGlass {
  static n = 0;

  el: HTMLElement;
  o: LiquidGlassOptions;
  private holder: SVGSVGElement;
  private filter: SVGFilterElement | null = null;
  private image: SVGImageElement | null = null;
  private id = "";
  private ro: ResizeObserver;
  private mw: number | null = null;
  private mh: number | null = null;
  private mr: number | null = null;
  private md: number | null = null;

  constructor(el: HTMLElement, options: Partial<LiquidGlassOptions> = {}) {
    this.el = el;
    this.o = { ...DEFAULTS, ...options };
    this.holder = document.createElementNS(SVG_NS, "svg");
    this.holder.setAttribute("width", "0");
    this.holder.setAttribute("height", "0");
    this.holder.style.display = "none";
    const root = el.getRootNode();
    (root instanceof ShadowRoot ? root : document.body).append(this.holder);
    this.ro = new ResizeObserver(() => {
      this.map();
      this.surface();
    });
    this.ro.observe(el);
    this.build();
    this.surface();
  }

  set(patch: Partial<LiquidGlassOptions> = {}) {
    const prev = this.o;
    this.o = { ...prev, ...patch };
    if ((prev.chromaticAberration > 0) !== (this.o.chromaticAberration > 0)) {
      this.chain();
    } else if (
      prev.strength !== this.o.strength ||
      prev.chromaticAberration !== this.o.chromaticAberration
    ) {
      this.scales();
    }
    if (prev.radius !== this.o.radius || prev.depth !== this.o.depth) {
      this.map();
    }
    this.surface();
    return this;
  }

  destroy() {
    this.ro.disconnect();
    this.holder.remove();
    this.el.style.backdropFilter = "";
    this.el.style.setProperty("-webkit-backdrop-filter", "");
  }

  private radiusPx() {
    return (
      this.o.radius ??
      parseFloat(getComputedStyle(this.el).borderTopLeftRadius || "0")
    );
  }

  private build() {
    this.id ||= `liquid-glass-${++LiquidGlass.n}`;
    this.holder.innerHTML = `
      <filter id="${this.id}" color-interpolation-filters="sRGB">
        <feImage x="0" y="0" preserveAspectRatio="xMidYMid slice" result="map"/>
      </filter>`;
    this.filter = this.holder.firstElementChild as SVGFilterElement;
    this.image = this.filter.firstElementChild as SVGImageElement;
    this.mw = this.mh = this.mr = this.md = null;
    this.map();
    this.chain();
  }

  private map() {
    if (!this.filter || !this.image) return;
    const box = this.el.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width));
    const h = Math.max(1, Math.round(box.height));
    const depth = this.o.depth;
    const radius = Math.max(0, Math.min(this.radiusPx(), Math.min(w, h) / 2));
    if (
      w === this.mw &&
      h === this.mh &&
      radius === this.mr &&
      depth === this.md
    ) {
      return;
    }
    this.mw = w;
    this.mh = h;
    this.mr = radius;
    this.md = depth;
    const map = encodeURIComponent(`
      <svg xmlns="${SVG_NS}" width="${w}" height="${h}">
        <style>.m{mix-blend-mode:screen}</style>
        <defs>
          <linearGradient id="x" x1="${Math.ceil((radius / w) * 15)}%" x2="${Math.floor(100 - (radius / w) * 15)}%" y1="0" y2="0">
            <stop offset="0%" stop-color="#f00"/><stop offset="100%" stop-color="#000"/>
          </linearGradient>
          <linearGradient id="y" x1="0" x2="0" y1="${Math.ceil((radius / h) * 15)}%" y2="${Math.floor(100 - (radius / h) * 15)}%">
            <stop offset="0%" stop-color="#0f0"/><stop offset="100%" stop-color="#000"/>
          </linearGradient>
        </defs>
        <rect width="${w}" height="${h}" fill="#808080"/>
        <g style="filter:blur(2px)">
          <rect width="${w}" height="${h}" fill="#000080"/>
          <rect width="${w}" height="${h}" fill="url(#x)" class="m"/>
          <rect width="${w}" height="${h}" fill="url(#y)" class="m"/>
          <rect x="${depth}" y="${depth}"
                width="${Math.max(1, w - 2 * depth)}" height="${Math.max(1, h - 2 * depth)}"
                fill="#808080" rx="${radius}" style="filter:blur(${depth}px)"/>
        </g>
      </svg>`);
    this.image.setAttribute("href", `data:image/svg+xml,${map}`);
    this.image.setAttribute("width", String(w));
    this.image.setAttribute("height", String(h));
  }

  private chain() {
    if (!this.filter || !this.image) return;
    const { strength: s, chromaticAberration: ca } = this.o;
    const ISO = {
      r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
      g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
      b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
    };
    const disp = (scale: number, ch: string) => `
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}"
        xChannelSelector="R" yChannelSelector="G" result="d${ch}"/>`;
    const keep = (ch: keyof typeof ISO) => `
      <feColorMatrix in="d${ch}" type="matrix" values="${ISO[ch]}" result="${ch}"/>`;
    const chain =
      ca > 0
        ? disp(s + ca * 2, "r") +
          keep("r") +
          disp(s + ca, "g") +
          keep("g") +
          disp(s, "b") +
          keep("b") +
          `<feBlend in="r" in2="g" mode="screen" result="rg"/>` +
          `<feBlend in="rg" in2="b" mode="screen"/>`
        : disp(s, "mono");
    while (this.filter.lastElementChild !== this.image) {
      this.filter.lastElementChild?.remove();
    }
    this.filter.insertAdjacentHTML("beforeend", chain);
  }

  private scales() {
    const { strength: s, chromaticAberration: ca } = this.o;
    const scale: Record<string, number> = {
      dr: s + ca * 2,
      dg: s + ca,
      db: s,
      dmono: s,
    };
    this.holder.querySelectorAll("feDisplacementMap").forEach((n) => {
      const key = n.getAttribute("result") ?? "";
      if (key in scale) n.setAttribute("scale", String(scale[key]));
    });
  }

  private surface() {
    const { blur, brightness } = this.o;
    if (this.o.radius != null) {
      this.el.style.borderRadius = `${this.radiusPx()}px`;
    }
    const f = [
      !NO_SVG_BACKDROP && `url(#${this.id})`,
      blur > 0 && `blur(${blur}px)`,
      `brightness(${brightness})`,
    ]
      .filter(Boolean)
      .join(" ");
    this.el.style.backdropFilter = f;
    this.el.style.setProperty("-webkit-backdrop-filter", f);
  }
}
