import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import {
  Playfair_Display,
  Hanken_Grotesk,
  JetBrains_Mono,
} from "next/font/google";
import "@/styles/globals.css";
import { getCurrentProfile } from "@/features/auth/queries";
import { CustomCursor } from "@/components/CustomCursor";
import { ThemeProvider } from "@/components/ThemeProvider";
import {
  DENSITY_COOKIE_NAME,
  MOTION_COOKIE_NAME,
  THEME_COOKIE_NAME,
  normalizeDensityPreference,
  normalizeMotionPreference,
  normalizeThemePreference,
  resolveThemeId,
} from "@/lib/themes/themes.config";
import { buildThemeInitScript } from "@/lib/themes/theme-init-script";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    /* theme-exempt: meta theme-color exige cor literal para a barra nativa do navegador */
    { media: "(prefers-color-scheme: light)", color: "#C8A46E" },
    /* theme-exempt: meta theme-color exige cor literal para a barra nativa do navegador */
    { media: "(prefers-color-scheme: dark)", color: "#141514" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://readingflow.app"),
  title: {
    default: "ReadingFlow — Biblioteca pessoal digital",
    template: "%s · ReadingFlow",
  },
  description:
    "Biblioteca pessoal digital elegante e privada para livros físicos, e-books e audiobooks. Catalogação rápida por ISBN, leitura independente da posse e portabilidade total.",
  keywords: [
    "biblioteca pessoal",
    "gerenciador de livros",
    "estante virtual 3D",
    "leituras",
    "audiobooks",
    "e-books",
    "portabilidade",
  ],
  authors: [{ name: "ReadingFlow" }],
  creator: "ReadingFlow",
  publisher: "ReadingFlow",
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ReadingFlow",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://readingflow.app",
    siteName: "ReadingFlow",
    title: "ReadingFlow — Biblioteca pessoal digital",
    description:
      "Biblioteca pessoal digital elegante e privada para livros físicos, e-books e audiobooks.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, cookieStore] = await Promise.all([
    getCurrentProfile(),
    cookies(),
  ]);

  // Prioridade: cookie local (última troca imediata) -> perfil do usuário (sincronizado entre dispositivos) -> padrão
  const themePref = normalizeThemePreference(
    cookieStore.get(THEME_COOKIE_NAME)?.value ?? profile?.theme
  );
  const densityPref = normalizeDensityPreference(
    cookieStore.get(DENSITY_COOKIE_NAME)?.value ?? profile?.density
  );
  const motionPref = normalizeMotionPreference(
    cookieStore.get(MOTION_COOKIE_NAME)?.value ?? profile?.motion
  );
  const initialResolvedTheme = resolveThemeId(themePref, false);
  const initScript = buildThemeInitScript();

  return (
    <html
      lang="pt-BR"
      data-theme={initialResolvedTheme}
      data-theme-pref={themePref}
      data-density={densityPref}
      data-motion={motionPref}
      className={`${hanken.variable} ${playfair.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          id="rf-theme-init"
          dangerouslySetInnerHTML={{ __html: initScript }}
        />
      </head>
      <body
        className="rf-desk-surface antialiased selection:bg-[var(--rf-accent-primary-subtle)] selection:text-[var(--rf-text-primary)]"
        suppressHydrationWarning
      >
        {/* Textura global de papel algodão quase imperceptível (pointer-events: none, z-40) */}
        <div aria-hidden="true" className="rf-cotton-paper" />
        <CustomCursor />
        <ThemeProvider
          initialTheme={themePref}
          initialDensity={densityPref}
          initialMotion={motionPref}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
