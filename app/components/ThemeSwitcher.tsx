"use client";

import { useTheme, type ThemePreference } from "./ThemeContext";

const OPTIONS: { id: Extract<ThemePreference, "light" | "dark">; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export default function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="themeSwitchWrapper" role="group" aria-label="Theme">
      <div className="themeSwitch">
        {OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`themeSwitchBtn themeSwitchBtn--${id}${
              preference === id ? " is-active" : ""
            }`}
            aria-label={label}
            aria-pressed={preference === id}
            onClick={() => setPreference(id)}
          >
            {id === "light" && (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="themeSwitchIcon">
                <circle cx="12" cy="12" r="4" fill="currentColor" />
                <g
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  fill="none"
                >
                  <path d="M12 2v2.2M12 19.8V22M4.2 12H2M22 12h-2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
                </g>
              </svg>
            )}
            {id === "dark" && (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="themeSwitchIcon">
                <path
                  fill="currentColor"
                  d="M14.2 3.1a8.8 8.8 0 1 0 6.7 14.6A7.2 7.2 0 0 1 14.2 3.1Z"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
