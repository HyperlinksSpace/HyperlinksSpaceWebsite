"use client";

import { useState } from "react";

export default function LanguageSwitcher() {
  const [language, setLanguage] = useState<"en" | "ru">("en");

  return (
    <div className="langSwitchWrapper">
      <div className="langSwitch">
        <img 
          src={`/lang_switch/ru_${language === "ru" ? "active" : "inactive"}.svg`} 
          alt="Русский" 
          className="ruIcon"
          onClick={() => setLanguage("ru")}
        />
        <img 
          src={`/lang_switch/en_${language === "en" ? "active" : "inactive"}.svg`} 
          alt="English" 
          className="enIcon"
          onClick={() => setLanguage("en")}
        />
        <img 
          src="/lang_switch/lang.svg" 
          alt="Language" 
          className="langIcon"
        />
      </div>
    </div>
  );
}
