"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Normalized viewport center (0–1). Persisted until reset. */
export type EarthPosition = {
  xRatio: number;
  yRatio: number;
};

export type EarthSettings = {
  enabled: boolean;
  play: boolean;
  /** Reference canvas width in px (4:3 like nxrix; ~720). */
  size: number;
  /** Orbit / eclipse animation speed. */
  speed: number;
  /** How often / strongly the moon aligns for eclipse (0–1). */
  eclipse: number;
  /** Accurate soft umbra vs stepped shadow. */
  realShadows: boolean;
  /** Atmosphere rim strength. */
  atmosphere: number;
  /** Extra exposure / bloom — boosted automatically on light theme. */
  overshine: number;
  /** Earth spin rate. */
  spin: number;
  position: EarthPosition | null;
};

const STORAGE_KEY = "hyperlinks-earth-v3";

export const DEFAULT_EARTH: EarthSettings = {
  enabled: true,
  play: true,
  // Half of nxrix reference width (~720 → 360), same 4:3 proportions
  size: 360,
  speed: 0.85,
  eclipse: 0.55,
  realShadows: true,
  atmosphere: 1,
  overshine: 1,
  spin: 0.35,
  position: null,
};

interface EarthContextType {
  settings: EarthSettings;
  setSettings: (
    next: EarthSettings | ((prev: EarthSettings) => EarthSettings)
  ) => void;
  resetSettings: () => void;
}

const EarthContext = createContext<EarthContextType | undefined>(undefined);

function normalizePosition(raw: unknown): EarthPosition | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<EarthPosition>;
  const xRatio = Number(p.xRatio);
  const yRatio = Number(p.yRatio);
  if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio)) return null;
  return {
    xRatio: Math.min(1, Math.max(0, xRatio)),
    yRatio: Math.min(1, Math.max(0, yRatio)),
  };
}

function normalize(raw: Partial<EarthSettings> | null): EarthSettings {
  const base = { ...DEFAULT_EARTH, ...(raw ?? {}) };
  return {
    enabled: Boolean(base.enabled),
    play: Boolean(base.play),
    size: Math.min(960, Math.max(240, Number(base.size) || DEFAULT_EARTH.size)),
    speed: Math.min(2.5, Math.max(0.1, Number(base.speed) || DEFAULT_EARTH.speed)),
    eclipse: Math.min(1, Math.max(0, Number(base.eclipse) || 0)),
    realShadows: Boolean(base.realShadows),
    atmosphere: Math.min(2, Math.max(0, Number(base.atmosphere) || 0)),
    overshine: Math.min(2.5, Math.max(0.4, Number(base.overshine) || DEFAULT_EARTH.overshine)),
    spin: Math.min(2, Math.max(0, Number(base.spin) || 0)),
    position: normalizePosition(base.position),
  };
}

export function EarthProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<EarthSettings>(DEFAULT_EARTH);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettingsState(normalize(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings, hydrated]);

  const setSettings = useCallback(
    (next: EarthSettings | ((prev: EarthSettings) => EarthSettings)) => {
      setSettingsState((prev) =>
        normalize(typeof next === "function" ? next(prev) : next)
      );
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_EARTH);
  }, []);

  const value = useMemo(
    () => ({ settings, setSettings, resetSettings }),
    [settings, setSettings, resetSettings]
  );

  return (
    <EarthContext.Provider value={value}>{children}</EarthContext.Provider>
  );
}

export function useEarth() {
  const ctx = useContext(EarthContext);
  if (!ctx) throw new Error("useEarth must be used within an EarthProvider");
  return ctx;
}
