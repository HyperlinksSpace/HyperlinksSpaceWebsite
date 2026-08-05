"use client";

import { useLanguage } from "./LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="langSwitchWrapper">
      <div className="langSwitch">
        <img
          src="/lang_switch/ru_active.svg"
          alt="Русский"
          className={`ruIcon${language === "ru" ? " is-active" : " is-inactive"}`}
          onClick={() => setLanguage("ru")}
        />
        <img
          src="/lang_switch/en_active.svg"
          alt="English"
          className={`enIcon${language === "en" ? " is-active" : " is-inactive"}`}
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
