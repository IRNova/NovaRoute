"use client";

import { useEffect } from "react";
import useThemeStore from "@/store/themeStore";

// First paint is owned by the blocking THEME_BOOTSTRAP script in
// src/app/layout.js, and the store re-applies on rehydrate. This effect is the
// belt-and-braces pass for the case where localStorage was unreadable at
// bootstrap time but became readable later.
export function ThemeProvider({ children }) {
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return <>{children}</>;
}

