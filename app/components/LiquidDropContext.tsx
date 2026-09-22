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

export type LiquidDropSettings = {
  /** Show the floating drop. */
  enabled: boolean;
  /** Drop diameter in px (glass circle). */
  size: number;
  /** Bounce speed multiplier. */
  speed: number;
  /** nxrix liquid-glass strength. */
  strength: number;
  /** Displacement depth. */
  depth: number;
  /** RGB separation. */
  chromaticAberration: number;
  /** Backdrop blur (px). */
  blur: number;
  /** Backdrop brightness. */
  brightness: number;
  /** Draw Program-style chaos bolts. */
  lightning: boolean;
  /** Bolt stroke width tune (Program default 2). */
  boltWidth: number;
  /** Lightning brightness / presence. */
  boltIntensity: number;
};

const STORAGE_KEY = "hyperlinks-liquid-drop-v1";

export const DEFAULT_LIQUID_DROP: LiquidDropSettings = {
  enabled: true,
  size: 112,
  speed: 1,
  strength: 72,
  depth: 10,
  chromaticAberration: 3,
  blur: 1.2,
  brightness: 0.92,
  lightning: true,
  boltWidth: 2,
  boltIntensity: 1,
};

interface LiquidDropContextType {
  settings: LiquidDropSettings;
  setSettings: (
    next:
      | LiquidDropSettings
      | ((prev: LiquidDropSettings) => LiquidDropSettings)
  ) => void;
  resetSettings: () => void;
}

const LiquidDropContext = createContext<LiquidDropContextType | undefined>(
  undefined
);

function normalize(raw: Partial<LiquidDropSettings> | null): LiquidDropSettings {
  const base = { ...DEFAULT_LIQUID_DROP, ...(raw ?? {}) };
  return {
    enabled: Boolean(base.enabled),
    size: Math.min(220, Math.max(56, Number(base.size) || DEFAULT_LIQUID_DROP.size)),
    speed: Math.min(2.5, Math.max(0.15, Number(base.speed) || DEFAULT_LIQUID_DROP.speed)),
    strength: Math.min(140, Math.max(8, Number(base.strength) || DEFAULT_LIQUID_DROP.strength)),
    depth: Math.min(24, Math.max(2, Number(base.depth) || DEFAULT_LIQUID_DROP.depth)),
    chromaticAberration: Math.min(
      12,
      Math.max(0, Number(base.chromaticAberration) || 0)
    ),
    blur: Math.min(8, Math.max(0, Number(base.blur) || 0)),
    brightness: Math.min(
      1.4,
      Math.max(0.5, Number(base.brightness) || DEFAULT_LIQUID_DROP.brightness)
    ),
    lightning: Boolean(base.lightning),
    boltWidth: Math.min(
      3,
      Math.max(0.4, Number(base.boltWidth) || DEFAULT_LIQUID_DROP.boltWidth)
    ),
    boltIntensity: Math.min(
      2,
      Math.max(0, Number(base.boltIntensity) || DEFAULT_LIQUID_DROP.boltIntensity)
    ),
  };
}

export function LiquidDropProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] =
    useState<LiquidDropSettings>(DEFAULT_LIQUID_DROP);
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
    (
      next:
        | LiquidDropSettings
        | ((prev: LiquidDropSettings) => LiquidDropSettings)
    ) => {
      setSettingsState((prev) =>
        normalize(typeof next === "function" ? next(prev) : next)
      );
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_LIQUID_DROP);
  }, []);

  const value = useMemo(
    () => ({ settings, setSettings, resetSettings }),
    [settings, setSettings, resetSettings]
  );

  return (
    <LiquidDropContext.Provider value={value}>
      {children}
    </LiquidDropContext.Provider>
  );
}

export function useLiquidDrop() {
  const ctx = useContext(LiquidDropContext);
  if (!ctx) {
    throw new Error("useLiquidDrop must be used within a LiquidDropProvider");
  }
  return ctx;
}
