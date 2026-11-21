"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_DENSITY,
  DEFAULT_MOTION,
  DEFAULT_THEME_ID,
  DENSITY_COOKIE_NAME,
  MOTION_COOKIE_NAME,
  THEME_COOKIE_NAME,
  THEMES,
  normalizeDensityPreference,
  normalizeMotionPreference,
  normalizeThemePreference,
  resolveThemeId,
} from "@/lib/themes/themes.config";
import type {
  DensityPreference,
  MotionPreference,
  ThemeId,
  ThemePreference,
} from "@/lib/themes/themes.types";
import { updateThemePreferencesAction } from "@/features/auth/actions";

export interface ThemeContextValue {
  themePreference: ThemePreference;
  resolvedTheme: ThemeId;
  density: DensityPreference;
  motion: MotionPreference;
  setTheme: (next: ThemePreference) => void;
  setDensity: (next: DensityPreference) => void;
  setMotion: (next: MotionPreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function writeClientCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function readClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function applyHtmlThemeAttributes(params: {
  preference: ThemePreference;
  resolved: ThemeId;
  density: DensityPreference;
  motion: MotionPreference;
  disableTransitionsForFrame?: boolean;
}): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prevTheme = root.getAttribute("data-theme");
  const isThemeChange =
    params.disableTransitionsForFrame && prevTheme && prevTheme !== params.resolved;

  if (isThemeChange) {
    root.setAttribute("data-theme-switching", "true");
  }

  root.setAttribute("data-theme", params.resolved);
  root.setAttribute("data-theme-pref", params.preference);
  root.setAttribute("data-density", params.density);
  root.setAttribute("data-motion", params.motion);
  root.style.colorScheme = THEMES[params.resolved].colorScheme;

  if (isThemeChange) {
    void root.offsetWidth;
    window.requestAnimationFrame(() => {
      root.removeAttribute("data-theme-switching");
    });
  }
}

export function ThemeProvider({
  initialTheme = DEFAULT_THEME_ID,
  initialDensity = DEFAULT_DENSITY,
  initialMotion = DEFAULT_MOTION,
  children,
}: {
  initialTheme?: ThemePreference;
  initialDensity?: DensityPreference;
  initialMotion?: MotionPreference;
  children: ReactNode;
}) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    () => normalizeThemePreference(initialTheme)
  );
  const [density, setDensityState] = useState<DensityPreference>(() =>
    normalizeDensityPreference(initialDensity)
  );
  const [motion, setMotionState] = useState<MotionPreference>(() =>
    normalizeMotionPreference(initialMotion)
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  // Sincroniza após a montagem com o cookie/media query caso a rota tenha sido prerenderizada estaticamente
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const frameId = window.requestAnimationFrame(() => {
      setSystemPrefersDark(mql.matches);
      const cookieTheme = readClientCookie(THEME_COOKIE_NAME);
      if (cookieTheme) {
        setThemePreferenceState(normalizeThemePreference(cookieTheme));
      }
      const cookieDensity = readClientCookie(DENSITY_COOKIE_NAME);
      if (cookieDensity) {
        setDensityState(normalizeDensityPreference(cookieDensity));
      }
      const cookieMotion = readClientCookie(MOTION_COOKIE_NAME);
      if (cookieMotion) {
        setMotionState(normalizeMotionPreference(cookieMotion));
      }
    });

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mql.addEventListener("change", handleChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      mql.removeEventListener("change", handleChange);
    };
  }, []);

  const resolvedTheme = useMemo(
    () => resolveThemeId(themePreference, systemPrefersDark),
    [themePreference, systemPrefersDark]
  );

  // Mantém o <html> sincronizado sempre que preferência, sistema, densidade ou movimento mudarem
  useEffect(() => {
    applyHtmlThemeAttributes({
      preference: themePreference,
      resolved: resolvedTheme,
      density,
      motion,
    });
  }, [themePreference, resolvedTheme, density, motion]);

  const setTheme = useCallback(
    (nextRaw: ThemePreference) => {
      const next = normalizeThemePreference(nextRaw);
      const nextResolved = resolveThemeId(next, systemPrefersDark);
      setThemePreferenceState(next);
      writeClientCookie(THEME_COOKIE_NAME, next);
      applyHtmlThemeAttributes({
        preference: next,
        resolved: nextResolved,
        density,
        motion,
        disableTransitionsForFrame: true,
      });
      void updateThemePreferencesAction({ theme: next }).catch(() => {});
    },
    [density, motion, systemPrefersDark]
  );

  const setDensity = useCallback(
    (nextRaw: DensityPreference) => {
      const next = normalizeDensityPreference(nextRaw);
      setDensityState(next);
      writeClientCookie(DENSITY_COOKIE_NAME, next);
      applyHtmlThemeAttributes({
        preference: themePreference,
        resolved: resolvedTheme,
        density: next,
        motion,
      });
      void updateThemePreferencesAction({ density: next }).catch(() => {});
    },
    [motion, resolvedTheme, themePreference]
  );

  const setMotion = useCallback(
    (nextRaw: MotionPreference) => {
      const next = normalizeMotionPreference(nextRaw);
      setMotionState(next);
      writeClientCookie(MOTION_COOKIE_NAME, next);
      applyHtmlThemeAttributes({
        preference: themePreference,
        resolved: resolvedTheme,
        density,
        motion: next,
      });
      void updateThemePreferencesAction({ motion: next }).catch(() => {});
    },
    [density, resolvedTheme, themePreference]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      density,
      motion,
      setTheme,
      setDensity,
      setMotion,
    }),
    [
      themePreference,
      resolvedTheme,
      density,
      motion,
      setTheme,
      setDensity,
      setMotion,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme deve ser usado dentro de <ThemeProvider>.");
  }
  return ctx;
}
