import {
  DEFAULT_DENSITY,
  DEFAULT_MOTION,
  DEFAULT_THEME_ID,
  DENSITY_COOKIE_NAME,
  MOTION_COOKIE_NAME,
  SYSTEM_THEME_PAIR,
  THEME_COOKIE_NAME,
} from "./themes.config";

/**
 * Gera o script inline bloqueante executado no `<head>` antes da primeira pintura
 * e antes da hidratação do React:
 * - Lê os cookies `rf_theme`, `rf_density` e `rf_motion` (sem depender de SSR dinâmico,
 *   preservando rotas `force-static` como `/` sem FOUC nem hydration mismatch).
 * - Quando `rf_theme === "system"`, resolve imediatamente via `prefers-color-scheme`
 *   usando o par Caderno ↔ Dark Academia (`SYSTEM_THEME_PAIR`).
 * - Aplica `data-theme`, `data-theme-pref`, `data-density`, `data-motion` e `colorScheme`
 *   no elemento `<html>`.
 */
export function buildThemeInitScript(): string {
  return `(function(){try{var d=document.documentElement;var read=function(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;};var rawTheme=read('${THEME_COOKIE_NAME}')||d.getAttribute('data-theme-pref')||'${DEFAULT_THEME_ID}';var map={light:'caderno','editorial-light':'caderno',caderno:'caderno',dark:'dark-academia','editorial-dark':'dark-academia','dark-academia':'dark-academia',escandinavo:'escandinavo',gotico:'gotico',system:'system'};var pref=map[rawTheme]||'${DEFAULT_THEME_ID}';var resolved=pref==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'${SYSTEM_THEME_PAIR.dark}':'${SYSTEM_THEME_PAIR.light}'):pref;var rawDensity=read('${DENSITY_COOKIE_NAME}')||d.getAttribute('data-density')||'${DEFAULT_DENSITY}';var density=(rawDensity==='compact'||rawDensity==='comfortable'||rawDensity==='spacious')?rawDensity:'${DEFAULT_DENSITY}';var rawMotion=read('${MOTION_COOKIE_NAME}')||d.getAttribute('data-motion')||'${DEFAULT_MOTION}';var motion=(rawMotion==='system'||rawMotion==='reduced'||rawMotion==='full')?rawMotion:'${DEFAULT_MOTION}';d.setAttribute('data-theme',resolved);d.setAttribute('data-theme-pref',pref);d.setAttribute('data-density',density);d.setAttribute('data-motion',motion);d.style.colorScheme=(resolved==='dark-academia'||resolved==='gotico')?'dark':'light';}catch(_){}})();`;
}
