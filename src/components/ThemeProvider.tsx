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
  DEFAULT_FX,
  DEFAULT_MOTION,
  DEFAULT_THEME_ID,
  DENSITY_COOKIE_NAME,
  FX_COOKIE_NAME,
  MOTION_COOKIE_NAME,
  THEME_COOKIE_NAME,
  THEMES,
  normalizeDensityPreference,
  normalizeFxPreference,
  normalizeMotionPreference,
  normalizeThemePreference,
  resolveThemeId,
} from "@/lib/themes/themes.config";
import type {
  DensityPreference,
  FxPreference,
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
  fx: FxPreference;
  setTheme: (next: ThemePreference) => void;
  setDensity: (next: DensityPreference) => void;
  setMotion: (next: MotionPreference) => void;
  setFx: (next: FxPreference) => void;
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
  fx: FxPreference;
  disableTransitionsForFrame?: boolean;
}): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prevTheme = root.getAttribute("data-theme");
  const isThemeChange =
    params.disableTransitionsForFrame &&
    prevTheme &&
    prevTheme !== params.resolved;

  if (isThemeChange) {
    root.setAttribute("data-theme-switching", "true");
  }

  root.setAttribute("data-theme", params.resolved);
  root.setAttribute("data-theme-pref", params.preference);
  root.setAttribute("data-density", params.density);
  root.setAttribute("data-motion", params.motion);
  root.setAttribute("data-fx", params.fx);
  root.style.setProperty("--rf-fx", params.fx === "min" ? "0" : "1");
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
  initialFx = DEFAULT_FX,
  isAuthenticated = false,
  children,
}: {
  initialTheme?: ThemePreference;
  initialDensity?: DensityPreference;
  initialMotion?: MotionPreference;
  initialFx?: FxPreference;
  isAuthenticated?: boolean;
  children: ReactNode;
}) {
  const normalizedInitialTheme = normalizeThemePreference(initialTheme);
  const normalizedInitialDensity = normalizeDensityPreference(initialDensity);
  const normalizedInitialMotion = normalizeMotionPreference(initialMotion);
  const normalizedInitialFx = normalizeFxPreference(initialFx);

  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    () => normalizedInitialTheme
  );
  const [density, setDensityState] = useState<DensityPreference>(
    () => normalizedInitialDensity
  );
  const [motion, setMotionState] = useState<MotionPreference>(
    () => normalizedInitialMotion
  );
  const [fx, setFxState] = useState<FxPreference>(() => normalizedInitialFx);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  // Quando o servidor entrega preferências atualizadas da conta (ex.: login/troca de conta), sincroniza estado e cookies
  useEffect(() => {
    if (!isAuthenticated) return;
    const frameId = window.requestAnimationFrame(() => {
      setThemePreferenceState(normalizedInitialTheme);
      setDensityState(normalizedInitialDensity);
      setMotionState(normalizedInitialMotion);
      const perfParam = new URLSearchParams(window.location.search).get("perf");
      setFxState(
        perfParam === "min" || perfParam === "full"
          ? perfParam
          : normalizedInitialFx
      );
      writeClientCookie(THEME_COOKIE_NAME, normalizedInitialTheme);
      writeClientCookie(DENSITY_COOKIE_NAME, normalizedInitialDensity);
      writeClientCookie(MOTION_COOKIE_NAME, normalizedInitialMotion);
      writeClientCookie(FX_COOKIE_NAME, normalizedInitialFx);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    isAuthenticated,
    normalizedInitialTheme,
    normalizedInitialDensity,
    normalizedInitialMotion,
    normalizedInitialFx,
  ]);

  // Sincroniza após a montagem com o cookie/media query caso a rota tenha sido prerenderizada estaticamente (visitantes)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const frameId = window.requestAnimationFrame(() => {
      setSystemPrefersDark(mql.matches);
      const perfParam = new URLSearchParams(window.location.search).get("perf");
      if (perfParam === "min" || perfParam === "full") {
        setFxState(perfParam);
      }
      if (isAuthenticated) {
        return;
      }
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
      if (perfParam !== "min" && perfParam !== "full") {
        const cookieFx = readClientCookie(FX_COOKIE_NAME);
        if (cookieFx) {
          setFxState(normalizeFxPreference(cookieFx));
        }
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
  }, [isAuthenticated]);

  const resolvedTheme = useMemo(
    () => resolveThemeId(themePreference, systemPrefersDark),
    [themePreference, systemPrefersDark]
  );

  // Mantém o <html> sincronizado sempre que preferência, sistema, densidade, movimento ou efeitos mudarem
  useEffect(() => {
    applyHtmlThemeAttributes({
      preference: themePreference,
      resolved: resolvedTheme,
      density,
      motion,
      fx,
    });
  }, [themePreference, resolvedTheme, density, motion, fx]);

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
        fx,
        disableTransitionsForFrame: true,
      });
      void updateThemePreferencesAction({ theme: next }).catch(() => {});
    },
    [density, fx, motion, systemPrefersDark]
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
        fx,
      });
      void updateThemePreferencesAction({ density: next }).catch(() => {});
    },
    [fx, motion, resolvedTheme, themePreference]
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
        fx,
      });
      void updateThemePreferencesAction({ motion: next }).catch(() => {});
    },
    [density, fx, resolvedTheme, themePreference]
  );

  const setFx = useCallback(
    (nextRaw: FxPreference) => {
      const next = normalizeFxPreference(nextRaw);
      setFxState(next);
      writeClientCookie(FX_COOKIE_NAME, next);
      applyHtmlThemeAttributes({
        preference: themePreference,
        resolved: resolvedTheme,
        density,
        motion,
        fx: next,
      });
      void updateThemePreferencesAction({ fx: next }).catch(() => {});
    },
    [density, motion, resolvedTheme, themePreference]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      density,
      motion,
      fx,
      setTheme,
      setDensity,
      setMotion,
      setFx,
    }),
    [
      themePreference,
      resolvedTheme,
      density,
      motion,
      fx,
      setTheme,
      setDensity,
      setMotion,
      setFx,
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
