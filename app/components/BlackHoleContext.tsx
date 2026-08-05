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

export type BlackHoleBody = {
  radius: number;
  spin: number;
  diskInner: number;
  diskOuter: number;
  hue: number;
};

export type BlackHoleMode = "auto" | "manual";

export type BlackHoleSettings = {
  enabled: boolean;
  binary: boolean;
  play: boolean;
  mode: BlackHoleMode;
  size: number;
  separation: number;
  perspective: number;
  glow: number;
  opacity: number;
  speed: number;
  sky: number;
  bh1: BlackHoleBody;
  bh2: BlackHoleBody;
};

const STORAGE_KEY = "hyperlinks-blackhole-v11";

export const DEFAULT_BLACK_HOLE: BlackHoleSettings = {
  enabled: true,
  binary: true,
  play: true,
  mode: "auto",
  size: 360,
  separation: 0.68,
  perspective: 1.1,
  glow: 1.3,
  opacity: 1,
  speed: 0.9,
  sky: 0.65,
  bh1: {
    radius: 0.18,
    spin: 1.15,
    diskInner: 1.5,
    diskOuter: 5.5,
    hue: 28,
  },
  bh2: {
    radius: 0.13,
    spin: -1.0,
    diskInner: 1.5,
    diskOuter: 4.8,
    hue: 210,
  },
};

interface BlackHoleContextType {
  settings: BlackHoleSettings;
  setSettings: (next: BlackHoleSettings | ((prev: BlackHoleSettings) => BlackHoleSettings)) => void;
  resetSettings: () => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

const BlackHoleContext = createContext<BlackHoleContextType | undefined>(undefined);

function clampBody(body: BlackHoleBody): BlackHoleBody {
  return {
    radius: Math.min(0.42, Math.max(0.08, body.radius)),
    spin: Math.min(1.8, Math.max(-1.8, body.spin)),
    diskInner: Math.min(2.2, Math.max(1.2, body.diskInner)),
    diskOuter: Math.min(9, Math.max(2.5, body.diskOuter)),
    hue: ((body.hue % 360) + 360) % 360,
  };
}

function normalize(raw: Partial<BlackHoleSettings> | null): BlackHoleSettings {
  const base = { ...DEFAULT_BLACK_HOLE, ...(raw ?? {}) };
  return {
    ...base,
    enabled: Boolean(base.enabled),
    binary: Boolean(base.binary),
    play: Boolean(base.play),
    mode: base.mode === "manual" ? "manual" : "auto",
    size: Math.min(360, Math.max(160, Number(base.size) || DEFAULT_BLACK_HOLE.size)),
    separation: Math.min(1.15, Math.max(0.35, Number(base.separation) || DEFAULT_BLACK_HOLE.separation)),
    perspective: Math.min(2, Math.max(0.7, Number(base.perspective) || DEFAULT_BLACK_HOLE.perspective)),
    glow: Math.min(2, Math.max(0.4, Number(base.glow) || DEFAULT_BLACK_HOLE.glow)),
    opacity: 1,
    speed: Math.min(2.2, Math.max(0.15, Number(base.speed) || DEFAULT_BLACK_HOLE.speed)),
    sky: Math.min(
      1.4,
      Math.max(
        0,
        Number.isFinite(Number(base.sky)) ? Number(base.sky) : DEFAULT_BLACK_HOLE.sky
      )
    ),
    bh1: clampBody({ ...DEFAULT_BLACK_HOLE.bh1, ...(base.bh1 ?? {}) }),
    bh2: clampBody({ ...DEFAULT_BLACK_HOLE.bh2, ...(base.bh2 ?? {}) }),
  };
}

export function BlackHoleProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<BlackHoleSettings>(DEFAULT_BLACK_HOLE);
  const [panelOpen, setPanelOpen] = useState(false);
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
    (next: BlackHoleSettings | ((prev: BlackHoleSettings) => BlackHoleSettings)) => {
      setSettingsState((prev) =>
        normalize(typeof next === "function" ? next(prev) : next)
      );
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_BLACK_HOLE);
  }, []);

  const value = useMemo(
    () => ({ settings, setSettings, resetSettings, panelOpen, setPanelOpen }),
    [settings, setSettings, resetSettings, panelOpen]
  );

  return (
    <BlackHoleContext.Provider value={value}>{children}</BlackHoleContext.Provider>
  );
}

export function useBlackHole() {
  const ctx = useContext(BlackHoleContext);
  if (!ctx) throw new Error("useBlackHole must be used within a BlackHoleProvider");
  return ctx;
}
