"use client";

import { useEffect, useSyncExternalStore } from "react";
import useThemeStore from "@/store/themeStore";

const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

// Subscribe to system theme changes
function subscribeToSystemTheme(callback) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mediaQuery = window.matchMedia(SYSTEM_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

// Get current system theme preference
function getSystemThemeSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(SYSTEM_QUERY).matches;
}

// Server render has no matchMedia. Nova is dark-first, so assume dark to match
// what the pre-paint script in layout.js puts on screen.
function getServerSnapshot() {
  return true;
}

export function useTheme() {
  const { theme, setTheme, toggleTheme, cycleTheme, initTheme } = useThemeStore();

  // Tracks the OS preference so `isDark` stays correct in "system" mode.
  // The store owns re-applying the .dark class; this only keeps React in sync.
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const isDark = theme === "system" ? systemPrefersDark : theme !== "light";

  return {
    theme,
    setTheme,
    toggleTheme,
    cycleTheme,
    isDark,
  };
}
