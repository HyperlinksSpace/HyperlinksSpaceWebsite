"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useBlackHole, type BlackHoleBody } from "./BlackHoleContext";
import { useLanguage } from "./LanguageContext";
import { useLiquidDrop } from "./LiquidDropContext";

const COPY = {
  en: {
    panelAria: "Site settings",
    title: "Settings",
    close: "Close",
    closeAria: "Close settings",
    bhSection: "Black hole",
    modeAria: "Tuning mode",
    auto: "Auto",
    manual: "Manual",
    visible: "Visible",
    binary: "Binary",
    play: "Play",
    autoHint: "Auto-tunes orbit, disks, lensed sky, and glow over time.",
    coreSize: "Core size",
    separation: "Separation",
    perspective: "Perspective",
    glow: "Glow",
    sky: "Sky / lensing",
    speed: "Speed",
    hole1: "Black hole 1",
    hole2: "Black hole 2",
    radius: "Radius",
    spin: "Spin",
    diskInner: "Disk inner (rₛ)",
    diskOuter: "Disk outer (rₛ)",
    hue: "Hue",
    glassSection: "Liquid glass",
    glassVisible: "Drop visible",
    glassFree: "Resume free float",
    glassSize: "Drop size",
    glassSpeed: "Drop speed",
    glassStrength: "Distortion",
    glassDepth: "Depth",
    glassCA: "Chromatic aberration",
    glassBlur: "Blur",
    glassBrightness: "Brightness",
    lightningSection: "Lightning",
    lightningOn: "Bolts",
    boltWidth: "Bolt width",
    boltIntensity: "Bolt intensity",
    reset: "Reset defaults",
    toggleAria: "Site settings",
  },
  ru: {
    panelAria: "Настройки сайта",
    title: "Настройки",
    close: "Закрыть",
    closeAria: "Закрыть настройки",
    bhSection: "Чёрная дыра",
    modeAria: "Режим настройки",
    auto: "Авто",
    manual: "Вручную",
    visible: "Видимость",
    binary: "Двойная",
    play: "Воспроизведение",
    autoHint:
      "Автоматически подстраивает орбиту, диски, линзированное небо и свечение.",
    coreSize: "Размер ядра",
    separation: "Разделение",
    perspective: "Перспектива",
    glow: "Свечение",
    sky: "Небо / линзирование",
    speed: "Скорость",
    hole1: "Чёрная дыра 1",
    hole2: "Чёрная дыра 2",
    radius: "Радиус",
    spin: "Вращение",
    diskInner: "Внутр. диск (rₛ)",
    diskOuter: "Внеш. диск (rₛ)",
    hue: "Оттенок",
    glassSection: "Жидкое стекло",
    glassVisible: "Капля видна",
    glassFree: "Снова свободно",
    glassSize: "Размер капли",
    glassSpeed: "Скорость капли",
    glassStrength: "Искажение",
    glassDepth: "Глубина",
    glassCA: "Хроматическая аберрация",
    glassBlur: "Размытие",
    glassBrightness: "Яркость",
    lightningSection: "Молнии",
    lightningOn: "Разряды",
    boltWidth: "Толщина молний",
    boltIntensity: "Интенсивность",
    reset: "Сбросить",
    toggleAria: "Настройки сайта",
  },
} as const;

type BhCopy = (typeof COPY)[keyof typeof COPY];

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`bhSlider${disabled ? " is-disabled" : ""}`}>
      <span className="bhSliderLabel">
        <span>{label}</span>
        <span className="bhSliderValue">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function BodyControls({
  title,
  body,
  onChange,
  disabled,
  t,
}: {
  title: string;
  body: BlackHoleBody;
  onChange: (next: BlackHoleBody) => void;
  disabled?: boolean;
  t: BhCopy;
}) {
  return (
    <fieldset className="bhFieldset" disabled={disabled}>
      <legend>{title}</legend>
      <SliderRow
        label={t.radius}
        value={body.radius}
        min={0.08}
        max={0.42}
        step={0.01}
        disabled={disabled}
        onChange={(radius) => onChange({ ...body, radius })}
      />
      <SliderRow
        label={t.spin}
        value={body.spin}
        min={-1.8}
        max={1.8}
        step={0.05}
        disabled={disabled}
        onChange={(spin) => onChange({ ...body, spin })}
      />
      <SliderRow
        label={t.diskInner}
        value={body.diskInner}
        min={1.2}
        max={2.2}
        step={0.05}
        disabled={disabled}
        onChange={(diskInner) => onChange({ ...body, diskInner })}
      />
      <SliderRow
        label={t.diskOuter}
        value={body.diskOuter}
        min={2.5}
        max={9}
        step={0.1}
        disabled={disabled}
        onChange={(diskOuter) => onChange({ ...body, diskOuter })}
      />
      <SliderRow
        label={t.hue}
        value={body.hue}
        min={0}
        max={359}
        step={1}
        disabled={disabled}
        onChange={(hue) => onChange({ ...body, hue })}
      />
    </fieldset>
  );
}

function BlackHoleIcon() {
  // C-like photon arc only — same mark on light and dark
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="themeSwitchIcon bhIcon">
      <defs>
        <linearGradient id="bhArcGlow" x1="3" y1="5" x2="19" y2="20">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="0.75" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path
        d="M18.4 8.2a7.1 7.1 0 1 0 0 7.6"
        fill="none"
        stroke="url(#bhArcGlow)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M17.2 7.4a8.2 8.2 0 1 0 .2 9.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

export default function SiteSettings() {
  const { settings, setSettings, resetSettings, panelOpen, setPanelOpen } =
    useBlackHole();
  const {
    settings: drop,
    setSettings: setDrop,
    resetSettings: resetDrop,
  } = useLiquidDrop();
  const { language } = useLanguage();
  const t = COPY[language] ?? COPY.en;
  const manual = settings.mode === "manual";

  useEffect(() => {
    document.documentElement.classList.toggle("bh-panel-open", panelOpen);
    return () => document.documentElement.classList.remove("bh-panel-open");
  }, [panelOpen]);

  const panel = panelOpen ? (
    <div
      id="bh-settings-panel"
      className="bhSettingsPanel"
      role="dialog"
      aria-label={t.panelAria}
      lang={language}
    >
      <div className="bhSettingsHead">
        <strong>{t.title}</strong>
        <button
          type="button"
          className="bhPanelClose"
          aria-label={t.closeAria}
          onClick={() => setPanelOpen(false)}
        >
          {t.close}
        </button>
      </div>

      <fieldset className="bhFieldset">
        <legend>{t.bhSection}</legend>

        <div className="bhModeRow" role="group" aria-label={t.modeAria}>
          <button
            type="button"
            className={`bhModeBtn${settings.mode === "auto" ? " is-active" : ""}`}
            aria-pressed={settings.mode === "auto"}
            onClick={() => setSettings((s) => ({ ...s, mode: "auto" }))}
          >
            {t.auto}
          </button>
          <button
            type="button"
            className={`bhModeBtn${settings.mode === "manual" ? " is-active" : ""}`}
            aria-pressed={settings.mode === "manual"}
            onClick={() => setSettings((s) => ({ ...s, mode: "manual" }))}
          >
            {t.manual}
          </button>
        </div>

        <div className="bhToggles">
          <label className="bhCheck">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) =>
                setSettings((s) => ({ ...s, enabled: e.target.checked }))
              }
            />
            {t.visible}
          </label>
          <label className="bhCheck">
            <input
              type="checkbox"
              checked={settings.binary}
              onChange={(e) =>
                setSettings((s) => ({ ...s, binary: e.target.checked }))
              }
            />
            {t.binary}
          </label>
          <label className="bhCheck">
            <input
              type="checkbox"
              checked={settings.play}
              onChange={(e) =>
                setSettings((s) => ({ ...s, play: e.target.checked }))
              }
            />
            {t.play}
          </label>
        </div>

        {!manual ? <p className="bhAutoHint">{t.autoHint}</p> : null}

        <SliderRow
          label={t.coreSize}
          value={settings.size}
          min={160}
          max={360}
          step={4}
          onChange={(size) => setSettings((s) => ({ ...s, size }))}
        />
        <SliderRow
          label={t.separation}
          value={settings.separation}
          min={0.35}
          max={1.15}
          step={0.01}
          disabled={!manual}
          onChange={(separation) => setSettings((s) => ({ ...s, separation }))}
        />
        <SliderRow
          label={t.perspective}
          value={settings.perspective}
          min={0.7}
          max={2}
          step={0.01}
          disabled={!manual}
          onChange={(perspective) => setSettings((s) => ({ ...s, perspective }))}
        />
        <SliderRow
          label={t.glow}
          value={settings.glow}
          min={0.4}
          max={2}
          step={0.01}
          disabled={!manual}
          onChange={(glow) => setSettings((s) => ({ ...s, glow }))}
        />
        <SliderRow
          label={t.sky}
          value={settings.sky}
          min={0}
          max={1.4}
          step={0.01}
          disabled={!manual}
          onChange={(sky) => setSettings((s) => ({ ...s, sky }))}
        />
        <SliderRow
          label={t.speed}
          value={settings.speed}
          min={0.15}
          max={2.2}
          step={0.05}
          onChange={(speed) => setSettings((s) => ({ ...s, speed }))}
        />

        <BodyControls
          title={t.hole1}
          body={settings.bh1}
          disabled={!manual}
          t={t}
          onChange={(bh1) => setSettings((s) => ({ ...s, bh1 }))}
        />
        {settings.binary ? (
          <BodyControls
            title={t.hole2}
            body={settings.bh2}
            disabled={!manual}
            t={t}
            onChange={(bh2) => setSettings((s) => ({ ...s, bh2 }))}
          />
        ) : null}
      </fieldset>

      <fieldset className="bhFieldset">
        <legend>{t.glassSection}</legend>
        <div className="bhToggles">
          <label className="bhCheck">
            <input
              type="checkbox"
              checked={drop.enabled}
              onChange={(e) =>
                setDrop((s) => ({ ...s, enabled: e.target.checked }))
              }
            />
            {t.glassVisible}
          </label>
        </div>
        {drop.position ? (
          <button
            type="button"
            className="bhReset"
            onClick={() => setDrop((s) => ({ ...s, position: null }))}
          >
            {t.glassFree}
          </button>
        ) : null}
        <SliderRow
          label={t.glassSize}
          value={drop.size}
          min={56}
          max={220}
          step={2}
          onChange={(size) => setDrop((s) => ({ ...s, size }))}
        />
        <SliderRow
          label={t.glassSpeed}
          value={drop.speed}
          min={0.15}
          max={2.5}
          step={0.05}
          onChange={(speed) => setDrop((s) => ({ ...s, speed }))}
        />
        <SliderRow
          label={t.glassStrength}
          value={drop.strength}
          min={8}
          max={140}
          step={1}
          onChange={(strength) => setDrop((s) => ({ ...s, strength }))}
        />
        <SliderRow
          label={t.glassDepth}
          value={drop.depth}
          min={2}
          max={24}
          step={1}
          onChange={(depth) => setDrop((s) => ({ ...s, depth }))}
        />
        <SliderRow
          label={t.glassCA}
          value={drop.chromaticAberration}
          min={0}
          max={12}
          step={0.5}
          onChange={(chromaticAberration) =>
            setDrop((s) => ({ ...s, chromaticAberration }))
          }
        />
        <SliderRow
          label={t.glassBlur}
          value={drop.blur}
          min={0}
          max={8}
          step={0.1}
          onChange={(blur) => setDrop((s) => ({ ...s, blur }))}
        />
        <SliderRow
          label={t.glassBrightness}
          value={drop.brightness}
          min={0.5}
          max={1.4}
          step={0.01}
          onChange={(brightness) => setDrop((s) => ({ ...s, brightness }))}
        />
      </fieldset>

      <fieldset className="bhFieldset">
        <legend>{t.lightningSection}</legend>
        <div className="bhToggles">
          <label className="bhCheck">
            <input
              type="checkbox"
              checked={drop.lightning}
              onChange={(e) =>
                setDrop((s) => ({ ...s, lightning: e.target.checked }))
              }
            />
            {t.lightningOn}
          </label>
        </div>
        <SliderRow
          label={t.boltWidth}
          value={drop.boltWidth}
          min={0.4}
          max={3}
          step={0.05}
          disabled={!drop.lightning}
          onChange={(boltWidth) => setDrop((s) => ({ ...s, boltWidth }))}
        />
        <SliderRow
          label={t.boltIntensity}
          value={drop.boltIntensity}
          min={0}
          max={2}
          step={0.05}
          disabled={!drop.lightning}
          onChange={(boltIntensity) =>
            setDrop((s) => ({ ...s, boltIntensity }))
          }
        />
      </fieldset>

      <button
        type="button"
        className="bhReset"
        onClick={() => {
          resetSettings();
          resetDrop();
        }}
      >
        {t.reset}
      </button>
    </div>
  ) : null;

  return (
    <div className="bhSettingsWrapper">
      <div className="bhSettings">
        <button
          type="button"
          className={`themeSwitchBtn bhSettingsToggle${panelOpen ? " is-active" : ""}`}
          aria-label={t.toggleAria}
          aria-expanded={panelOpen}
          aria-controls="bh-settings-panel"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <BlackHoleIcon />
        </button>
      </div>
      {/* Portal escapes backdrop-filter containing-block (was crushing height on mobile) */}
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
