"use client";

import { useState } from "react";

export default function LanguageSwitcher() {
  const [language, setLanguage] = useState<"en" | "ru">("en");

  return (
    <div className="langSwitchWrapper" style={{
      "--lang-switch-left": "20px",
      "--lang-switch-bottom": "20px"
    } as React.CSSProperties}>
      <div className="langSwitch" onClick={() => setLanguage(language === "en" ? "ru" : "en")}>
        <img src="/lang_switch/lang.svg" alt="Language" />
        {language === "en" ? (
          <img src="/lang_switch/en.svg" alt="English" />
        ) : (
          <img src="/lang_switch/ru.svg" alt="Русский" />
        )}
      </div>
    </div>
  );
}
