import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { readingFlowThemePlugin } from "./scripts/eslint-no-hardcoded-colors.mjs";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    // Guarda contra regressão (Fases 1–3): bloqueia cores hardcoded em componentes compartilhados, layouts e telas de referência.
    // Fora do escopo: cores de capas/lombadas (`BookCover`, `Book3D`, `cover-color`, `spine-color-rules`).
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/ThemeProvider.tsx",
      "src/components/ThemeSwitcher.tsx",
      "src/components/ThemeCardsPicker.tsx",
      "src/components/SettingsClient.tsx",
      "src/app/dev/**/*.{ts,tsx}",
      "src/app/layout.tsx",
      "src/app/(app)/layout.tsx",
      "src/app/(marketing)/layout.tsx",
      "src/app/(marketing)/page.tsx",
      "src/app/(auth)/layout.tsx",
      "src/components/layout/LibraryBackdrop.tsx",
      "src/components/AppShell.tsx",
      "src/components/MastheadNav.tsx",
      "src/components/SidebarNav.tsx",
      "src/components/GlobalSearchBar.tsx",
      "src/components/UndoBanner.tsx",
      "src/components/CustomCursor.tsx",
      "src/components/MarketingHeader.tsx",
      "src/components/MarketingSessionActions.tsx",
      "src/components/MarketingFooter.tsx",
      "src/components/LandingProductPreview.tsx",
      "src/app/(app)/painel/**/*.{ts,tsx}",
      "src/app/(app)/estante-3d/**/*.{ts,tsx}",
      "src/app/(app)/explorar/**/*.{ts,tsx}",
      "src/app/(app)/evolucao/**/*.{ts,tsx}",
      "src/components/ActiveReadingSpotlight.tsx",
      "src/components/QuickReadingUpdater.tsx",
      "src/components/ReadingStreakCard.tsx",
      "src/components/RecentActivityFeed.tsx",
      "src/components/MonthlyStatsCard.tsx",
      "src/components/CollectionStatusOverview.tsx",
      "src/components/MetricFormulaHint.tsx",
      "src/components/DashboardBlockState.tsx",
      "src/components/StatusBadge.tsx",
      "src/components/StarRating.tsx",
      "src/components/ProgressBar.tsx",
      "src/components/ShelfView.tsx",
      "src/components/BackfillCoversModal.tsx",
      "src/components/ExplorarSearchAndDiscoveryClient.tsx",
      "src/components/ExplorarWishlistSectionClient.tsx",
    ],
    plugins: {
      readingflow: readingFlowThemePlugin,
    },
    rules: {
      "readingflow/no-hardcoded-colors": "error",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".agents/**",
      ".docs/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
