"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useBlackHole, type BlackHoleBody } from "./BlackHoleContext";

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
}: {
  title: string;
  body: BlackHoleBody;
  onChange: (next: BlackHoleBody) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="bhFieldset" disabled={disabled}>
      <legend>{title}</legend>
      <SliderRow
        label="Radius"
        value={body.radius}
        min={0.08}
        max={0.42}
        step={0.01}
        disabled={disabled}
        onChange={(radius) => onChange({ ...body, radius })}
      />
      <SliderRow
        label="Spin"
        value={body.spin}
        min={-1.8}
        max={1.8}
        step={0.05}
        disabled={disabled}
        onChange={(spin) => onChange({ ...body, spin })}
      />
      <SliderRow
        label="Disk inner (rₛ)"
        value={body.diskInner}
        min={1.2}
        max={2.2}
        step={0.05}
        disabled={disabled}
        onChange={(diskInner) => onChange({ ...body, diskInner })}
      />
      <SliderRow
        label="Disk outer (rₛ)"
        value={body.diskOuter}
        min={2.5}
        max={9}
        step={0.1}
        disabled={disabled}
        onChange={(diskOuter) => onChange({ ...body, diskOuter })}
      />
      <SliderRow
        label="Hue"
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
  // Compact singularity mark — void + bright incomplete photon arc (not rings / eye / Saturn).
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="themeSwitchIcon bhIcon">
      <defs>
        <linearGradient id="bhArcGlow" x1="3" y1="5" x2="19" y2="20">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="0.75" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* Soft outer glow */}
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
      {/* Photon arc — open on one side so it reads as a BH, not a planet */}
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
      {/* Event horizon */}
      <circle className="bhIconVoid" cx="12" cy="12" r="4.6" />
    </svg>
  );
}

export default function SiteSettings() {
  const { settings, setSettings, resetSettings, panelOpen, setPanelOpen } =
    useBlackHole();
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
      aria-label="Black hole controls"
    >
      <div className="bhSettingsHead">
        <strong>Black hole</strong>
        <button
          type="button"
          className="bhPanelClose"
          aria-label="Close settings"
          onClick={() => setPanelOpen(false)}
        >
          Close
        </button>
      </div>

      <div className="bhModeRow" role="group" aria-label="Tuning mode">
        <button
          type="button"
          className={`bhModeBtn${settings.mode === "auto" ? " is-active" : ""}`}
          aria-pressed={settings.mode === "auto"}
          onClick={() => setSettings((s) => ({ ...s, mode: "auto" }))}
        >
          Auto
        </button>
        <button
          type="button"
          className={`bhModeBtn${settings.mode === "manual" ? " is-active" : ""}`}
          aria-pressed={settings.mode === "manual"}
          onClick={() => setSettings((s) => ({ ...s, mode: "manual" }))}
        >
          Manual
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
          Visible
        </label>
        <label className="bhCheck">
          <input
            type="checkbox"
            checked={settings.binary}
            onChange={(e) =>
              setSettings((s) => ({ ...s, binary: e.target.checked }))
            }
          />
          Binary
        </label>
        <label className="bhCheck">
          <input
            type="checkbox"
            checked={settings.play}
            onChange={(e) =>
              setSettings((s) => ({ ...s, play: e.target.checked }))
            }
          />
          Play
        </label>
      </div>

      {!manual ? (
        <p className="bhAutoHint">
          Auto-tunes orbit, disks, lensed sky, and glow over time.
        </p>
      ) : null}

      <SliderRow
        label="Core size"
        value={settings.size}
        min={160}
        max={320}
        step={4}
        onChange={(size) => setSettings((s) => ({ ...s, size }))}
      />
      <SliderRow
        label="Separation"
        value={settings.separation}
        min={0.35}
        max={1.15}
        step={0.01}
        disabled={!manual}
        onChange={(separation) => setSettings((s) => ({ ...s, separation }))}
      />
      <SliderRow
        label="Perspective"
        value={settings.perspective}
        min={0.7}
        max={2}
        step={0.01}
        disabled={!manual}
        onChange={(perspective) => setSettings((s) => ({ ...s, perspective }))}
      />
      <SliderRow
        label="Glow"
        value={settings.glow}
        min={0.4}
        max={2}
        step={0.01}
        disabled={!manual}
        onChange={(glow) => setSettings((s) => ({ ...s, glow }))}
      />
      <SliderRow
        label="Sky / lensing"
        value={settings.sky}
        min={0}
        max={1.4}
        step={0.01}
        disabled={!manual}
        onChange={(sky) => setSettings((s) => ({ ...s, sky }))}
      />
      <SliderRow
        label="Speed"
        value={settings.speed}
        min={0.15}
        max={2.2}
        step={0.05}
        onChange={(speed) => setSettings((s) => ({ ...s, speed }))}
      />

      <BodyControls
        title="Black hole 1"
        body={settings.bh1}
        disabled={!manual}
        onChange={(bh1) => setSettings((s) => ({ ...s, bh1 }))}
      />
      {settings.binary ? (
        <BodyControls
          title="Black hole 2"
          body={settings.bh2}
          disabled={!manual}
          onChange={(bh2) => setSettings((s) => ({ ...s, bh2 }))}
        />
      ) : null}

      <button type="button" className="bhReset" onClick={resetSettings}>
        Reset defaults
      </button>
    </div>
  ) : null;

  return (
    <div className="bhSettingsWrapper">
      <div className="bhSettings">
        <button
          type="button"
          className={`themeSwitchBtn bhSettingsToggle${panelOpen ? " is-active" : ""}`}
          aria-label="Black hole settings"
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
