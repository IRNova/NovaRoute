"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEME_CONFIG } from "@/shared/constants/config";

const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark() {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(SYSTEM_QUERY).matches;
}

// Resolve a stored preference ("dark" | "light" | "system") to what actually
// gets painted.
export function resolveTheme(theme) {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme === "light" ? "light" : "dark";
}

// Apply theme to the document.
function applyTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: THEME_CONFIG.defaultTheme,

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      // Flip to the opposite of what is currently ON SCREEN. When the stored
      // value is "system" the old implementation compared against the literal
      // string "system", so a click could resolve to the theme already being
      // shown and appear to do nothing. Resolving first makes one click always
      // change something, and turns "system" into an explicit choice rather
      // than silently discarding it.
      toggleTheme: () => {
        const next = resolveTheme(get().theme) === "dark" ? "light" : "dark";
        set({ theme: next });
        applyTheme(next);
      },

      // Cycle dark -> light -> system, for controls that expose all three.
      cycleTheme: () => {
        const order = ["dark", "light", "system"];
        const idx = order.indexOf(get().theme);
        const next = order[(idx + 1) % order.length];
        set({ theme: next });
        applyTheme(next);
      },

      initTheme: () => {
        applyTheme(get().theme);
      },
    }),
    {
      name: THEME_CONFIG.storageKey,
      // Repaint once the persisted value has been rehydrated, otherwise the
      // store briefly reports the default rather than the stored preference.
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);

// Keep "system" actually live: when the OS flips while the user is sitting on
// the page, repaint. Previously matchMedia was read once per applyTheme() call
// and nothing ever re-ran it, so "system" froze at whatever it was on load.
if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia(SYSTEM_QUERY);
  const onChange = () => {
    if (useThemeStore.getState().theme === "system") {
      applyTheme("system");
      // Nudge subscribers (useTheme's isDark) without changing the stored value.
      useThemeStore.setState({ theme: "system" });
    }
  };
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

export default useThemeStore;
