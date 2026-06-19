"use client";

import { useEffect } from "react";

export default function ViewportFix() {
  useEffect(() => {
    const setViewportHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      const width = window.visualViewport?.width ?? window.innerWidth;
      document.documentElement.style.setProperty("--vh", `${height * 0.01}px`);
      document.documentElement.style.setProperty("--vw", `${width * 0.01}px`);
    };

    setViewportHeight();

    window.addEventListener("resize", setViewportHeight);
    window.addEventListener("orientationchange", setViewportHeight);
    window.visualViewport?.addEventListener("resize", setViewportHeight);
    window.visualViewport?.addEventListener("scroll", setViewportHeight);

    return () => {
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);
      window.visualViewport?.removeEventListener("resize", setViewportHeight);
      window.visualViewport?.removeEventListener("scroll", setViewportHeight);
    };
  }, []);

  return null;
}
