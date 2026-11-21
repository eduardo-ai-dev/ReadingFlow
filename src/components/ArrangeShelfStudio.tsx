"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  Check,
  ChevronLeft,
  Lamp,
  Layers,
  Palette,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  groupBooksByGenre,
  normalizeVirtualBook,
  type NormalizedVirtualBook,
  type VirtualBookItem,
} from "@/features/shelves/virtual-bookshelf";
import {
  applyShelfPreset,
  BOOK_DISPLAY_MODE_OPTIONS,
  buildCustomShelfRows,
  DEFAULT_SHELF_THEME_CONFIG,
  EMPTY_PERSISTED_SHELF_LAYOUT,
  extractPredominantDotColors,
  normalizeShelfKey,
  parsePersistedShelfLayout,
  patchShelfThemeConfig,
  SHELF_BACKDROP_OPTIONS,
  SHELF_BRACKET_OPTIONS,
  SHELF_DECOR_OPTIONS,
  SHELF_DENSITY_OPTIONS,
  SHELF_LAYOUT_STORAGE_KEY,
  SHELF_MATERIAL_V2_OPTIONS,
  SHELF_PRESETS,
  sortBooksByColorHue,
  toLegacyOrganizationMode,
  toLegacyShelfMaterial,
  type BookDisplayMode,
  type DecorItemType,
  type OrganizationMode,
  type PersistedShelfLayout,
  type ShelfDecorPlacement,
  type ShelfHeaderMeta,
  type ShelfPresetId,
  type ShelfThemeConfig,
} from "@/features/shelves/arrange-shelves";
import {
  importLegacyLocalSettingsAction,
  saveShelfCustomizationAction,
} from "@/features/settings/actions";
import {
  ShelfView,
  type MoveBookParams,
  type ShelfRenderGroup,
} from "@/components/ShelfView";
import { BookCover } from "@/components/BookCover";
import { ArrangeQuickAddModal } from "@/components/ArrangeQuickAddModal";
import { rfButtonClassName } from "@/components/ui/ActionControls";
import styles from "./VirtualBookshelf.module.css";

interface StudioShelf {
  key: string;
  title: string;
  bookIds: string[];
  meta: ShelfHeaderMeta;
}

type StudioTabId = "estilo" | "objetos" | "livro" | "prateleiras";
type DecorInsertSpot = "start" | "middle" | "end" | "after-selected";

const DOT_PALETTE_PRESETS: ReadonlyArray<{ label: string; dots: string[] }> = [
  { label: "Preto & Verde", dots: ["#1E1D1B", "#2D4F3E"] },
  { label: "Cores Vivas", dots: ["#A62C2B", "#D97724", "#EAB308", "#2B5B84"] },
  { label: "Marfim & Nogueira", dots: ["#F5F2EB", "#6D442B"] },
  { label: "Bordô & Ouro", dots: ["#722F3E", "#C8A46E", "#1E1D1B"] },
];

const QUICK_TITLE_SUGGESTIONS = [
  "Lista de Leitura",
  "Clássicos",
  "Não-Ficção",
  "Ficção Contemporânea",
  "Favoritos",
];

const SPINE_COLOR_SWATCHES: readonly { hex: string; label: string }[] = [
  { hex: "#2B2D2B", label: "Grafite" },
  { hex: "#722F3E", label: "Bordô" },
  { hex: "#9B3A3A", label: "Carmim" },
  { hex: "#BD6633", label: "Terracota" },
  { hex: "#C4A13B", label: "Ocre" },
  { hex: "#3A6652", label: "Verde Floresta" },
  { hex: "#385B94", label: "Azul Cobalto" },
  { hex: "#5E4287", label: "Ameixa" },
  { hex: "#78523A", label: "Nogueira" },
  { hex: "#D8D2C6", label: "Marfim" },
];

const ORG_MODE_V2_OPTIONS: ReadonlyArray<{
  id: OrganizationMode;
  label: string;
  description: string;
}> = [
  {
    id: "cor",
    label: "Por Cor",
    description: "Harmonia cromática e pílulas de paleta",
  },
  {
    id: "genero",
    label: "Por Gênero",
    description: "Prateleiras agrupadas por gênero literário",
  },
  {
    id: "livre",
    label: "Livre",
    description: "Títulos próprios e ordem manual livre",
  },
];

function buildShelves(
  allBooks: readonly VirtualBookItem[],
  layout: PersistedShelfLayout
): StudioShelf[] {
  const grouped = groupBooksByGenre(allBooks, {
    unifyTaxonomy: true,
    compactSmallThreshold: 2,
    miscLabel: "Miscelânea",
  });

  const map = new Map<string, StudioShelf>();
  for (const g of grouped) {
    const meta = layout.shelfMeta[g.genreKey] ?? {};
    map.set(g.genreKey, {
      key: g.genreKey,
      title: meta.title?.trim() || g.genre,
      bookIds: [],
      meta,
    });
  }
  for (const cs of layout.customShelves) {
    if (map.has(cs.key)) continue;
    const meta = layout.shelfMeta[cs.key] ?? {};
    map.set(cs.key, {
      key: cs.key,
      title: meta.title?.trim() || cs.title,
      bookIds: [],
      meta,
    });
  }

  for (const g of grouped) {
    for (const book of g.books) {
      const id = String(book.id);
      const override = layout.bookShelfMap[id];
      const destKey = override && map.has(override) ? override : g.genreKey;
      map.get(destKey)?.bookIds.push(id);
    }
  }

  for (const shelf of map.values()) {
    const order = layout.customOrderByShelf[shelf.key];
    if (!order || order.length === 0) continue;
    const rank = new Map(order.map((id, idx) => [id, idx]));
    shelf.bookIds.sort((a, b) => {
      const ra = rank.get(a);
      const rb = rank.get(b);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return 0;
    });
  }

  const keys: string[] = [];
  for (const k of layout.shelfOrder) {
    if (map.has(k) && !keys.includes(k)) keys.push(k);
  }
  for (const k of map.keys()) {
    if (!keys.includes(k)) keys.push(k);
  }
  const customKeys = new Set(layout.customShelves.map((c) => c.key));
  return keys
    .map((k) => map.get(k)!)
    .filter((s) => s.bookIds.length > 0 || customKeys.has(s.key));
}

let decorIdCounter = 0;

function nextDecorId(decorType: DecorItemType): string {
  decorIdCounter += 1;
  return `decor-${decorType}-${Date.now().toString(36)}-${decorIdCounter.toString(36)}`;
}

function hasCustomShelfLayout(layout: PersistedShelfLayout): boolean {
  return (
    layout.shelfOrder.length > 0 ||
    layout.customShelves.length > 0 ||
    Object.keys(layout.bookShelfMap).length > 0 ||
    Object.keys(layout.shelfMeta).length > 0 ||
    Object.keys(layout.customOrderByShelf).length > 0 ||
    Object.keys(layout.bookColorOverrides ?? {}).length > 0 ||
    Object.keys(layout.bookDisplayModes ?? {}).length > 0 ||
    Object.keys(layout.shelfDecorByRow ?? {}).length > 0 ||
    (layout.themeConfig?.presetId !== undefined &&
      layout.themeConfig.presetId !== DEFAULT_SHELF_THEME_CONFIG.presetId) ||
    (layout.themeConfig?.material !== undefined &&
      layout.themeConfig.material !== DEFAULT_SHELF_THEME_CONFIG.material) ||
    (layout.themeConfig?.nicheBackdrop !== undefined &&
      layout.themeConfig.nicheBackdrop !==
        DEFAULT_SHELF_THEME_CONFIG.nicheBackdrop)
  );
}

export interface ArrangeShelfStudioProps {
  initialBooks: readonly VirtualBookItem[];
  initialShelfLayout?: PersistedShelfLayout;
  backHref?: string;
  onSaved?: () => void;
}

export function ArrangeShelfStudio({
  initialBooks,
  initialShelfLayout,
  backHref = "/estante-3d",
  onSaved,
}: ArrangeShelfStudioProps) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();

  const [booksPool, setBooksPool] = useState<VirtualBookItem[]>(() => [
    ...initialBooks,
  ]);
  const [savedLayout, setSavedLayout] = useState<PersistedShelfLayout>(
    () => initialShelfLayout ?? EMPTY_PERSISTED_SHELF_LAYOUT
  );
  const [legacyLayoutRaw, setLegacyLayoutRaw] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<"ok" | "error">("ok");

  // Detecta uma única vez se existe arrumação antiga presa no localStorage do navegador quando a conta ainda não tem layout salvo
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SHELF_LAYOUT_STORAGE_KEY);
      if (!raw) return;
      if (hasCustomShelfLayout(savedLayout)) {
        // A conta já tem layout sincronizado no servidor — limpa resíduo legado local
        window.localStorage.removeItem(SHELF_LAYOUT_STORAGE_KEY);
        return;
      }
      const parsed = parsePersistedShelfLayout(raw);
      if (hasCustomShelfLayout(parsed)) {
        const frameId = window.requestAnimationFrame(() => {
          setLegacyLayoutRaw(raw);
        });
        return () => window.cancelAnimationFrame(frameId);
      }
      window.localStorage.removeItem(SHELF_LAYOUT_STORAGE_KEY);
    } catch {
      // Ignora indisponibilidade de localStorage
    }
  }, [savedLayout]);

  // Rascunhos locais (null = espelha exatamente o layout salvo)
  const [draft, setDraft] = useState<StudioShelf[] | null>(null);
  const [draftThemeConfig, setDraftThemeConfig] =
    useState<ShelfThemeConfig | null>(null);
  const [draftColorOverrides, setDraftColorOverrides] = useState<Record<
    string,
    string
  > | null>(null);
  const [draftDisplayModes, setDraftDisplayModes] = useState<Record<
    string,
    BookDisplayMode
  > | null>(null);
  const [draftTiltDirections, setDraftTiltDirections] = useState<Record<
    string,
    "left" | "right"
  > | null>(null);
  const [draftDecorByRow, setDraftDecorByRow] = useState<Record<
    string,
    ShelfDecorPlacement[]
  > | null>(null);

  const effectiveThemeConfig: ShelfThemeConfig =
    draftThemeConfig ?? savedLayout.themeConfig ?? DEFAULT_SHELF_THEME_CONFIG;
  const effectiveColorOverrides = useMemo(
    () => draftColorOverrides ?? savedLayout.bookColorOverrides ?? {},
    [draftColorOverrides, savedLayout.bookColorOverrides]
  );
  const effectiveDisplayModes = useMemo(
    () => draftDisplayModes ?? savedLayout.bookDisplayModes ?? {},
    [draftDisplayModes, savedLayout.bookDisplayModes]
  );
  const effectiveTiltDirections = useMemo(
    () => draftTiltDirections ?? savedLayout.bookTiltDirections ?? {},
    [draftTiltDirections, savedLayout.bookTiltDirections]
  );
  const effectiveDecorByRow = useMemo(
    () => draftDecorByRow ?? savedLayout.shelfDecorByRow ?? {},
    [draftDecorByRow, savedLayout.shelfDecorByRow]
  );

  const bookById = useMemo(
    () =>
      new Map(
        booksPool.map((b) => {
          const override = effectiveColorOverrides[String(b.id)];
          return [
            String(b.id),
            override
              ? { ...b, spineColor: override, spineAccent: undefined }
              : b,
          ];
        })
      ),
    [booksPool, effectiveColorOverrides]
  );

  const baseShelves = useMemo(
    () => buildShelves(booksPool, savedLayout),
    [booksPool, savedLayout]
  );
  const shelves = draft ?? baseShelves;

  const dirty =
    draft !== null ||
    draftThemeConfig !== null ||
    draftColorOverrides !== null ||
    draftDisplayModes !== null ||
    draftTiltDirections !== null ||
    draftDecorByRow !== null;

  const mutateShelves = (updater: (prev: StudioShelf[]) => StudioShelf[]) => {
    setDraft((prev) => updater(prev ?? baseShelves));
  };

  const [activeTab, setActiveTab] = useState<StudioTabId>("estilo");
  const [selected, setSelected] = useState<{
    shelfKey: string;
    bookId: string;
  } | null>(null);
  const [targetDecorShelfKey, setTargetDecorShelfKey] = useState<string>("");
  const [decorInsertSpot, setDecorInsertSpot] =
    useState<DecorInsertSpot>("end");
  const [editingShelfKey, setEditingShelfKey] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAsTitle, setDraftAsTitle] = useState(false);
  const [draftDots, setDraftDots] = useState<string[] | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [newShelfTitle, setNewShelfTitle] = useState("");
  const [quickAddTarget, setQuickAddTarget] = useState<{
    shelfKey: string;
    shelfTitle: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resolvedDecorShelfKey = useMemo(() => {
    if (
      targetDecorShelfKey &&
      shelves.some((s) => s.key === targetDecorShelfKey)
    ) {
      return targetDecorShelfKey;
    }
    if (selected && shelves.some((s) => s.key === selected.shelfKey)) {
      return selected.shelfKey;
    }
    return shelves[0]?.key ?? "";
  }, [targetDecorShelfKey, selected, shelves]);

  const showNotice = (msg: string, kind: "ok" | "error" = "ok") => {
    setNoticeKind(kind);
    setNotice(msg);
    window.setTimeout(
      () => setNotice((cur) => (cur === msg ? null : cur)),
      kind === "error" ? 5000 : 3200
    );
  };

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const renderShelves = useMemo<ShelfRenderGroup[]>(
    () =>
      shelves.map((shelf) => {
        let prevBg: string | null = null;
        const books: NormalizedVirtualBook[] = [];
        for (const id of shelf.bookIds) {
          const raw = bookById.get(id);
          if (!raw) continue;
          const normalized = normalizeVirtualBook(
            raw,
            shelf.key,
            shelf.title,
            prevBg
          );
          prevBg = normalized.spineBg;
          books.push(normalized);
        }
        const colors =
          shelf.meta.customDots && shelf.meta.customDots.length > 0
            ? shelf.meta.customDots
            : extractPredominantDotColors(books, (b) => b.spineBg, 4);
        const defaultTitle =
          effectiveThemeConfig.organizationMode === "genero" ||
          effectiveThemeConfig.organizationMode === "livre";
        const displayAsTitle =
          shelf.meta.displayAsTitle !== undefined
            ? shelf.meta.displayAsTitle
            : defaultTitle;
        return {
          genreKey: shelf.key,
          genre: shelf.title,
          books,
          kind: displayAsTitle ? "title" : "color",
          colors,
          hasCustomColors: Boolean(
            shelf.meta.customDots && shelf.meta.customDots.length > 0
          ),
          isCustom: true,
        };
      }),
    [shelves, bookById, effectiveThemeConfig.organizationMode]
  );

  const selectedBook = selected
    ? (renderShelves
        .find((s) => s.genreKey === selected.shelfKey)
        ?.books.find((b) => String(b.id) === selected.bookId) ?? null)
    : null;

  /* ---------- Handlers de tema / presets ---------- */
  const handleApplyPreset = (
    presetId: Exclude<ShelfPresetId, "personalizada">
  ) => {
    const next = applyShelfPreset(effectiveThemeConfig, presetId);
    setDraftThemeConfig(next);
    const label =
      SHELF_PRESETS.find((p) => p.id === presetId)?.label ?? presetId;
    showNotice(`Preset “${label}” aplicado.`);
  };

  const handlePatchTheme = (
    patch: Partial<Omit<ShelfThemeConfig, "presetId">>,
    feedback?: string
  ) => {
    const next = patchShelfThemeConfig(effectiveThemeConfig, patch);
    setDraftThemeConfig(next);
    if (feedback) showNotice(feedback);
  };

  const handleSelectOrganizationMode = (mode: OrganizationMode) => {
    handlePatchTheme({ organizationMode: mode });
    if (mode === "cor") {
      mutateShelves((prev) =>
        prev.map((shelf) => {
          const normalizedBooks = shelf.bookIds
            .map((id) => bookById.get(id))
            .filter((b): b is VirtualBookItem => Boolean(b))
            .map((raw) => normalizeVirtualBook(raw, shelf.key, shelf.title));
          const sortedIds = sortBooksByColorHue(
            normalizedBooks,
            (b) => b.spineBg
          ).map((b) => String(b.id));
          return {
            ...shelf,
            bookIds: sortedIds,
            meta: {
              ...shelf.meta,
              displayAsTitle: false,
            },
          };
        })
      );
      showNotice("Organização por cor aplicada às prateleiras.");
      return;
    }

    if (mode === "genero") {
      const allCurrentBooks = Array.from(bookById.values());
      const byGenre = groupBooksByGenre(allCurrentBooks, {
        unifyTaxonomy: true,
        compactSmallThreshold: 2,
        miscLabel: "Miscelânea",
      });
      setDraft(
        byGenre.map((g) => ({
          key: g.genreKey,
          title: g.genre,
          bookIds: g.books.map((b) => String(b.id)),
          meta: {
            title: g.genre,
            displayAsTitle: true,
          },
        }))
      );
      showNotice("Prateleiras organizadas por gênero literário.");
      return;
    }

    mutateShelves((prev) =>
      prev.map((shelf) => ({
        ...shelf,
        meta: {
          ...shelf.meta,
          title: shelf.title,
          displayAsTitle: true,
        },
      }))
    );
    showNotice("Modo livre ativado: renomeie e ordene como preferir.");
  };

  /* ---------- Handlers de objetos decorativos ---------- */
  const handleAddDecor = (decorType: DecorItemType) => {
    if (!resolvedDecorShelfKey) return;
    const shelf = shelves.find((s) => s.key === resolvedDecorShelfKey);
    if (!shelf) return;

    let afterBookIndex = Math.max(0, shelf.bookIds.length);
    if (decorInsertSpot === "start") {
      afterBookIndex = -1;
    } else if (decorInsertSpot === "middle") {
      afterBookIndex = Math.max(0, Math.floor(shelf.bookIds.length / 2) - 1);
    } else if (
      decorInsertSpot === "after-selected" &&
      selected &&
      selected.shelfKey === resolvedDecorShelfKey
    ) {
      const idx = shelf.bookIds.indexOf(selected.bookId);
      afterBookIndex = idx >= 0 ? idx : shelf.bookIds.length;
    }

    const id = nextDecorId(decorType);
    const nextItem: ShelfDecorPlacement = {
      id,
      decorType,
      afterBookIndex,
    };

    setDraftDecorByRow((prev) => {
      const base = prev ?? savedLayout.shelfDecorByRow ?? {};
      const currentList = base[resolvedDecorShelfKey] ?? [];
      return {
        ...base,
        [resolvedDecorShelfKey]: [...currentList, nextItem],
      };
    });

    const label =
      SHELF_DECOR_OPTIONS.find((opt) => opt.id === decorType)?.label ??
      decorType;
    showNotice(`${label} adicionado à prateleira “${shelf.title}”.`);
  };

  const handleRemoveDecor = (shelfKey: string, decorId: string) => {
    setDraftDecorByRow((prev) => {
      const base = prev ?? savedLayout.shelfDecorByRow ?? {};
      const currentList = base[shelfKey] ?? [];
      const nextList = currentList.filter((item) => item.id !== decorId);
      const next = { ...base };
      if (nextList.length === 0) {
        delete next[shelfKey];
      } else {
        next[shelfKey] = nextList;
      }
      return next;
    });
    showNotice("Objeto removido da prateleira.");
  };

  const handleClearShelfDecor = (shelfKey: string) => {
    setDraftDecorByRow((prev) => {
      const base = prev ?? savedLayout.shelfDecorByRow ?? {};
      const next = { ...base };
      delete next[shelfKey];
      return next;
    });
    showNotice("Objetos da prateleira removidos.");
  };

  /* ---------- Handlers individuais de livro ---------- */
  const handleSetBookDisplayMode = (bookId: string, mode: BookDisplayMode) => {
    setDraftDisplayModes((prev) => {
      const base = { ...(prev ?? savedLayout.bookDisplayModes ?? {}) };
      if (mode === "lombada") {
        delete base[bookId];
      } else {
        base[bookId] = mode;
      }
      return base;
    });
    const label =
      BOOK_DISPLAY_MODE_OPTIONS.find((opt) => opt.id === mode)?.label ?? mode;
    showNotice(`Exibição alterada para “${label}”.`);
  };

  const handleSetBookTiltDirection = (
    bookId: string,
    direction: "left" | "right"
  ) => {
    setDraftTiltDirections((prev) => ({
      ...(prev ?? savedLayout.bookTiltDirections ?? {}),
      [bookId]: direction,
    }));
  };

  const handleChangeSelectedColor = (bookId: string, hex: string | null) => {
    setDraftColorOverrides((prev) => {
      const base = { ...(prev ?? savedLayout.bookColorOverrides ?? {}) };
      if (hex) {
        base[bookId] = hex;
      } else {
        delete base[bookId];
      }
      return base;
    });
  };

  const handleReorderWithinShelf = (
    shelf: ShelfRenderGroup,
    nextBooks: NormalizedVirtualBook[]
  ) => {
    const ids = nextBooks.map((b) => String(b.id));
    mutateShelves((prev) =>
      prev.map((s) => (s.key === shelf.genreKey ? { ...s, bookIds: ids } : s))
    );
  };

  const moveBook = ({
    bookId,
    fromShelfKey,
    toShelfKey,
    targetBookId,
    position,
  }: MoveBookParams) => {
    mutateShelves((prev) => {
      const from = prev.find((s) => s.key === fromShelfKey);
      const to = prev.find((s) => s.key === toShelfKey);
      if (!from || !to || !from.bookIds.includes(bookId)) return prev;

      const withoutMoved = (ids: string[]) => ids.filter((id) => id !== bookId);
      const insert = (ids: string[]) => {
        const next = withoutMoved(ids);
        const targetIdx = targetBookId ? next.indexOf(targetBookId) : -1;
        if (targetIdx < 0) {
          next.push(bookId);
        } else {
          next.splice(
            position === "after" ? targetIdx + 1 : targetIdx,
            0,
            bookId
          );
        }
        return next;
      };

      return prev.map((s) => {
        if (fromShelfKey === toShelfKey && s.key === fromShelfKey) {
          return { ...s, bookIds: insert(s.bookIds) };
        }
        if (s.key === fromShelfKey)
          return { ...s, bookIds: withoutMoved(s.bookIds) };
        if (s.key === toShelfKey) return { ...s, bookIds: insert(s.bookIds) };
        return s;
      });
    });
  };

  const handleNudgeSelected = (delta: -1 | 1) => {
    if (!selected) return;
    mutateShelves((prev) =>
      prev.map((s) => {
        if (s.key !== selected.shelfKey) return s;
        const idx = s.bookIds.indexOf(selected.bookId);
        const target = idx + delta;
        if (idx < 0 || target < 0 || target >= s.bookIds.length) return s;
        const copy = [...s.bookIds];
        const [moved] = copy.splice(idx, 1);
        if (!moved) return s;
        copy.splice(target, 0, moved);
        return { ...s, bookIds: copy };
      })
    );
  };

  /* ---------- Handlers de prateleiras ---------- */
  const handleSortByColor = (shelfKey: string) => {
    const shelf = renderShelves.find((s) => s.genreKey === shelfKey);
    if (!shelf) return;
    const sorted = sortBooksByColorHue(shelf.books, (b) => b.spineBg).map((b) =>
      String(b.id)
    );
    mutateShelves((prev) =>
      prev.map((s) => (s.key === shelfKey ? { ...s, bookIds: sorted } : s))
    );
    showNotice(`Livros de “${shelf.genre}” ordenados por cor.`);
  };

  const handleMoveShelf = (shelfKey: string, delta: -1 | 1) => {
    mutateShelves((prev) => {
      const idx = prev.findIndex((s) => s.key === shelfKey);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      if (!moved) return prev;
      copy.splice(target, 0, moved);
      return copy;
    });
  };

  const handleDeleteShelf = (shelfKey: string) => {
    mutateShelves((prev) => {
      if (prev.length <= 1) return prev;
      const doomed = prev.find((s) => s.key === shelfKey);
      const rest = prev.filter((s) => s.key !== shelfKey);
      if (!doomed || doomed.bookIds.length === 0) return rest;
      const destIdx = Math.max(
        0,
        rest.findIndex((s) => s.key === "miscelanea")
      );
      const dest = rest[destIdx]!;
      rest[destIdx] = {
        ...dest,
        bookIds: [...dest.bookIds, ...doomed.bookIds],
      };
      return rest;
    });
    if (editingShelfKey === shelfKey) setEditingShelfKey(null);
    showNotice("Prateleira removida. Os livros foram realocados.");
  };

  const openEditor = (shelfKey: string) => {
    if (editingShelfKey === shelfKey) {
      setEditingShelfKey(null);
      return;
    }
    const shelf = shelves.find((s) => s.key === shelfKey);
    if (!shelf) return;
    setEditingShelfKey(shelfKey);
    setDraftTitle(shelf.title);
    setDraftAsTitle(Boolean(shelf.meta.displayAsTitle));
    setDraftDots(shelf.meta.customDots);
  };

  const applyEditor = (shelfKey: string) => {
    const clean = draftTitle.trim() || "Prateleira";
    mutateShelves((prev) =>
      prev.map((s) =>
        s.key === shelfKey
          ? {
              ...s,
              title: clean,
              meta: {
                ...s.meta,
                title: clean,
                displayAsTitle: draftAsTitle,
                customDots: draftDots,
              },
            }
          : s
      )
    );
    setEditingShelfKey(null);
    showNotice(`Prateleira “${clean}” atualizada.`);
  };

  const handleCreateShelf = () => {
    const clean = newShelfTitle.trim();
    if (!clean) return;
    const baseKey = normalizeShelfKey(clean);
    const key = shelves.some((s) => s.key === baseKey)
      ? `${baseKey}-${Date.now().toString(36)}`
      : baseKey;
    mutateShelves((prev) => [
      ...prev,
      {
        key,
        title: clean,
        bookIds: [],
        meta: { title: clean, displayAsTitle: true },
      },
    ]);
    setTargetDecorShelfKey(key);
    setNewShelfTitle("");
    setCreating(false);
    showNotice(`Prateleira “${clean}” criada.`);
  };

  const handleBookAdded = (newBook: VirtualBookItem, shelfKey: string) => {
    setBooksPool((prev) => [...prev, newBook]);
    mutateShelves((prev) =>
      prev.map((s) =>
        s.key === shelfKey
          ? { ...s, bookIds: [...s.bookIds, String(newBook.id)] }
          : s
      )
    );
    showNotice(`“${newBook.title}” adicionado à prateleira.`);
  };

  /* ---------- Salvar / Restaurar / Importação única legada ---------- */
  const handleSave = () => {
    const bookShelfMap: Record<string, string> = {};
    const customOrderByShelf: Record<string, string[]> = {};
    const shelfMeta: Record<string, ShelfHeaderMeta> = {};
    const libraryItemIds: string[] = [];

    for (const shelf of shelves) {
      shelfMeta[shelf.key] = { ...shelf.meta, title: shelf.title };
      customOrderByShelf[shelf.key] = [...shelf.bookIds];
      for (const id of shelf.bookIds) {
        bookShelfMap[id] = shelf.key;
        const itemId = bookById.get(id)?.libraryItemId;
        if (itemId) libraryItemIds.push(itemId);
      }
    }

    const colorOverridesToSave = { ...effectiveColorOverrides };
    const displayModesToSave = { ...effectiveDisplayModes };
    const tiltDirectionsToSave = { ...effectiveTiltDirections };
    const decorToSave = { ...effectiveDecorByRow };
    const featuredCoverIds = Object.entries(displayModesToSave)
      .filter(([, mode]) => mode === "capa_frente")
      .map(([bookId]) => bookId);
    const customRows = buildCustomShelfRows({
      shelves,
      bookDisplayModes: displayModesToSave,
      bookTiltDirections: tiltDirectionsToSave,
      bookColorOverrides: colorOverridesToSave,
      shelfDecorByRow: decorToSave,
    });

    const nextLayout: PersistedShelfLayout = {
      shelfOrder: shelves.map((s) => s.key),
      bookShelfMap,
      customShelves: shelves.map((s) => ({ key: s.key, title: s.title })),
      shelfMeta,
      customOrderByShelf,
      featuredCoverIds,
      bookColorOverrides: colorOverridesToSave,
      shelfMaterial: toLegacyShelfMaterial(effectiveThemeConfig.material),
      organizationMode: toLegacyOrganizationMode(
        effectiveThemeConfig.organizationMode
      ),
      themeConfig: effectiveThemeConfig,
      bookDisplayModes: displayModesToSave,
      bookTiltDirections: tiltDirectionsToSave,
      shelfDecorByRow: decorToSave,
      customRows,
    };

    const colorOverridesByItemId: Record<string, string> = {};
    for (const [bookId, hex] of Object.entries(colorOverridesToSave)) {
      const itemId = bookById.get(bookId)?.libraryItemId;
      if (itemId) {
        colorOverridesByItemId[itemId] = hex;
      }
    }

    // Snapshot anterior para rollback imediato caso a gravação no servidor falhe
    const previousLayout = savedLayout;
    const prevDraft = draft;
    const prevThemeConfig = draftThemeConfig;
    const prevColorOverrides = draftColorOverrides;
    const prevDisplayModes = draftDisplayModes;
    const prevTiltDirections = draftTiltDirections;
    const prevDecorByRow = draftDecorByRow;

    // Atualização otimista
    setSavedLayout(nextLayout);
    setDraft(null);
    setDraftThemeConfig(null);
    setDraftColorOverrides(null);
    setDraftDisplayModes(null);
    setDraftTiltDirections(null);
    setDraftDecorByRow(null);

    startSave(async () => {
      try {
        const res = await saveShelfCustomizationAction({
          layout: nextLayout,
          orderedItemIds: libraryItemIds,
          colorOverridesByItemId,
        });
        if (!res.ok) {
          setSavedLayout(previousLayout);
          setDraft(prevDraft);
          setDraftThemeConfig(prevThemeConfig);
          setDraftColorOverrides(prevColorOverrides);
          setDraftDisplayModes(prevDisplayModes);
          setDraftTiltDirections(prevTiltDirections);
          setDraftDecorByRow(prevDecorByRow);
          showNotice(
            `Não foi possível salvar na sua conta. Alterações revertidas: ${res.error}`,
            "error"
          );
          return;
        }
        setSavedLayout(res.layout);
        setLegacyLayoutRaw(null);
        try {
          window.localStorage.removeItem(SHELF_LAYOUT_STORAGE_KEY);
        } catch {
          // Ignora indisponibilidade de localStorage
        }
        router.refresh();
        showNotice(
          "Personalização salva na sua conta e sincronizada com a Estante 3D!"
        );
        onSaved?.();
      } catch {
        setSavedLayout(previousLayout);
        setDraft(prevDraft);
        setDraftThemeConfig(prevThemeConfig);
        setDraftColorOverrides(prevColorOverrides);
        setDraftDisplayModes(prevDisplayModes);
        setDraftTiltDirections(prevTiltDirections);
        setDraftDecorByRow(prevDecorByRow);
        showNotice(
          "Falha de conexão ao salvar na sua conta. As alterações foram revertidas — tente novamente.",
          "error"
        );
      }
    });
  };

  const handleReset = () => {
    const previousLayout = savedLayout;
    const prevDraft = draft;
    const prevThemeConfig = draftThemeConfig;
    const prevColorOverrides = draftColorOverrides;
    const prevDisplayModes = draftDisplayModes;
    const prevTiltDirections = draftTiltDirections;
    const prevDecorByRow = draftDecorByRow;

    setSavedLayout(EMPTY_PERSISTED_SHELF_LAYOUT);
    setDraft(null);
    setDraftThemeConfig(null);
    setDraftColorOverrides(null);
    setDraftDisplayModes(null);
    setDraftTiltDirections(null);
    setDraftDecorByRow(null);
    setSelected(null);
    setEditingShelfKey(null);

    startSave(async () => {
      try {
        const res = await saveShelfCustomizationAction({ layout: null });
        if (!res.ok) {
          setSavedLayout(previousLayout);
          setDraft(prevDraft);
          setDraftThemeConfig(prevThemeConfig);
          setDraftColorOverrides(prevColorOverrides);
          setDraftDisplayModes(prevDisplayModes);
          setDraftTiltDirections(prevTiltDirections);
          setDraftDecorByRow(prevDecorByRow);
          showNotice(
            `Não foi possível restaurar o padrão: ${res.error}`,
            "error"
          );
          return;
        }
        setSavedLayout(res.layout);
        setLegacyLayoutRaw(null);
        try {
          window.localStorage.removeItem(SHELF_LAYOUT_STORAGE_KEY);
        } catch {
          // Ignora indisponibilidade de localStorage
        }
        router.refresh();
        showNotice("Configuração padrão restaurada na sua conta.");
      } catch {
        setSavedLayout(previousLayout);
        setDraft(prevDraft);
        setDraftThemeConfig(prevThemeConfig);
        setDraftColorOverrides(prevColorOverrides);
        setDraftDisplayModes(prevDisplayModes);
        setDraftTiltDirections(prevTiltDirections);
        setDraftDecorByRow(prevDecorByRow);
        showNotice(
          "Falha de conexão ao restaurar o padrão. Tente novamente.",
          "error"
        );
      }
    });
  };

  const handleImportLegacyLocal = () => {
    if (!legacyLayoutRaw) return;
    const rawToImport = legacyLayoutRaw;
    startSave(async () => {
      try {
        const res = await importLegacyLocalSettingsAction({
          shelfLayoutRaw: rawToImport,
        });
        if (!res.ok) {
          showNotice(`Não foi possível importar: ${res.error}`, "error");
          return;
        }
        setSavedLayout(res.settings.shelfLayout);
        setLegacyLayoutRaw(null);
        try {
          window.localStorage.removeItem(SHELF_LAYOUT_STORAGE_KEY);
        } catch {
          // Ignora indisponibilidade de localStorage
        }
        router.refresh();
        showNotice("Arrumação antiga importada para sua conta!");
      } catch {
        showNotice(
          "Erro ao importar arrumação antiga. Tente novamente.",
          "error"
        );
      }
    });
  };

  const handleDismissLegacyLocal = () => {
    setLegacyLayoutRaw(null);
    try {
      window.localStorage.removeItem(SHELF_LAYOUT_STORAGE_KEY);
    } catch {
      // Ignora indisponibilidade de localStorage
    }
  };

  const activeDecorList = resolvedDecorShelfKey
    ? (effectiveDecorByRow[resolvedDecorShelfKey] ?? [])
    : [];
  const selectedBookMode: BookDisplayMode = selected
    ? (effectiveDisplayModes[selected.bookId] ?? "lombada")
    : "lombada";
  const selectedBookTilt: "left" | "right" = selected
    ? (effectiveTiltDirections[selected.bookId] ?? "right")
    : "right";

  const activePresetLabel =
    effectiveThemeConfig.presetId === "personalizada"
      ? "Personalizada"
      : (SHELF_PRESETS.find((p) => p.id === effectiveThemeConfig.presetId)
          ?.label ?? "Clássica");

  return (
    <div className="w-full py-2 text-[var(--rf-text-primary)] sm:py-3">
      {/* Cabeçalho do Estúdio */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rf-border-default)] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            aria-label="Voltar para a Estante 3D"
            onClick={(e) => {
              if (
                dirty &&
                !window.confirm("Há alterações não salvas. Sair mesmo assim?")
              ) {
                e.preventDefault();
              }
            }}
            className={rfButtonClassName({
              variant: "secondary",
              secondaryStyle: "outline",
              size: "sm",
              pill: true,
            })}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>Estante 3D</span>
          </Link>

          <div>
            <span className="rf-section-marker">03 · Estúdio da Estante</span>
            <h1 className="font-serif text-xl font-semibold text-[var(--rf-text-heading)] sm:text-2xl">
              Personalizar estante
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] px-3 py-1 font-sans text-xs font-medium text-[var(--rf-text-secondary)]">
            <Sparkles
              className="h-3.5 w-3.5 text-[var(--rf-accent-primary)]"
              aria-hidden="true"
            />
            <span>Estilo: {activePresetLabel}</span>
          </span>

          <button
            type="button"
            onClick={handleReset}
            className={rfButtonClassName({
              variant: "subtle",
              size: "sm",
              pill: true,
            })}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restaurar padrão</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className={rfButtonClassName({
              variant: "primary",
              size: "sm",
              pill: true,
            })}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>
              {isSaving
                ? "Salvando..."
                : dirty
                  ? "Salvar alterações •"
                  : "Salvar na Estante 3D"}
            </span>
          </button>
        </div>
      </header>

      {legacyLayoutRaw ? (
        <div
          role="region"
          aria-label="Importar arrumação antiga deste navegador"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-card)] px-4 py-3 font-sans text-xs text-[var(--rf-text-primary)] shadow-xs"
        >
          <p className="min-w-0 flex-1">
            Encontramos uma arrumação antiga salva neste navegador. Deseja
            importá-la para sua conta?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleImportLegacyLocal}
              className={rfButtonClassName({
                variant: "primary",
                size: "sm",
                pill: true,
              })}
            >
              Importar para minha conta
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleDismissLegacyLocal}
              className={rfButtonClassName({
                variant: "subtle",
                size: "sm",
                pill: true,
              })}
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div
          role={noticeKind === "error" ? "alert" : "status"}
          aria-live={noticeKind === "error" ? "assertive" : "polite"}
          className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 font-sans text-xs font-semibold shadow-xs ${
            noticeKind === "error"
              ? "border-[var(--status-error)]/40 bg-[var(--status-error)]/10 text-[var(--status-error)]"
              : "border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-card)] text-[var(--rf-text-heading)]"
          }`}
        >
          <Check
            className="h-4 w-4 shrink-0 text-[var(--rf-accent-primary)]"
            aria-hidden="true"
          />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Layout Principal em 2 Colunas: Palco ao Vivo (Esquerda) + Estúdio de Controle (Direita) */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        {/* COLUNA ESQUERDA: Estante ao Vivo */}
        <section
          aria-label="Pré-visualização interativa da estante"
          className="flex flex-col items-center gap-4"
        >
          <div className="flex w-full max-w-[640px] flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-card)] px-3.5 py-2.5">
            <p className="font-sans text-xs text-[var(--rf-text-secondary)]">
              Clique em um livro para personalizar capa, inclinação ou cor ·
              Arraste para reorganizar
            </p>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className={rfButtonClassName({
                variant: "secondary",
                secondaryStyle: "outline",
                size: "sm",
                pill: true,
              })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nova prateleira</span>
            </button>
          </div>

          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateShelf();
              }}
              className="flex w-full max-w-[640px] flex-wrap items-center gap-2 rounded-2xl border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-card)] p-3 shadow-xs"
            >
              <label htmlFor="new-shelf-name" className="sr-only">
                Nome da nova prateleira
              </label>
              <input
                id="new-shelf-name"
                type="text"
                value={newShelfTitle}
                onChange={(e) => setNewShelfTitle(e.target.value)}
                placeholder="Nome da prateleira (ex: Clássicos de Ouro)"
                className="min-w-[200px] flex-1 rounded-lg border border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] px-3 py-2 font-sans text-sm text-[var(--rf-text-primary)] placeholder:text-[var(--rf-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
              />
              <button
                type="submit"
                className={rfButtonClassName({
                  variant: "primary",
                  size: "sm",
                })}
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className={rfButtonClassName({ variant: "subtle", size: "sm" })}
              >
                Cancelar
              </button>
            </form>
          ) : null}

          <ShelfView
            mode="edit"
            shelfMaterial={toLegacyShelfMaterial(effectiveThemeConfig.material)}
            themeConfig={effectiveThemeConfig}
            bookDisplayModes={effectiveDisplayModes}
            bookTiltDirections={effectiveTiltDirections}
            shelfDecorByRow={effectiveDecorByRow}
            onRemoveDecor={handleRemoveDecor}
            shelves={renderShelves}
            activeBookId={selected?.bookId ?? null}
            view3dMode="spines"
            onSelectBook={(book) => {
              const holder = renderShelves.find((s) =>
                s.books.some((b) => b.id === book.id)
              );
              if (!holder) return;
              const id = String(book.id);
              setSelected((cur) => {
                if (cur?.bookId === id) {
                  return null;
                }
                setActiveTab("livro");
                setTargetDecorShelfKey(holder.genreKey);
                return { shelfKey: holder.genreKey, bookId: id };
              });
            }}
            onReorderWithinShelf={handleReorderWithinShelf}
            onMoveBookAcrossShelves={(params) => {
              moveBook(params);
              setSelected((cur) =>
                cur?.bookId === params.bookId
                  ? { shelfKey: params.toShelfKey, bookId: params.bookId }
                  : cur
              );
            }}
            editingShelfKey={editingShelfKey}
            onEditShelf={openEditor}
            onMoveShelf={handleMoveShelf}
            onDeleteShelf={handleDeleteShelf}
            onSortShelfByColor={handleSortByColor}
            onAddBook={(shelfKey) => {
              const shelf = shelves.find((s) => s.key === shelfKey);
              setQuickAddTarget({
                shelfKey,
                shelfTitle: shelf?.title ?? "Miscelânea",
              });
            }}
            renderShelfEditor={(shelf) => (
              <div
                className={styles.shelfHeaderEditPanel}
                role="region"
                aria-label={`Editar prateleira ${shelf.genre}`}
              >
                <div className={styles.shelfEditRow}>
                  <label
                    htmlFor={`edit-shelf-${shelf.genreKey}`}
                    className="sr-only"
                  >
                    Nome da prateleira
                  </label>
                  <input
                    id={`edit-shelf-${shelf.genreKey}`}
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className={styles.shelfEditInput}
                  />
                  <button
                    type="button"
                    onClick={() => applyEditor(shelf.genreKey)}
                    className={styles.primaryActionBtn}
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingShelfKey(null)}
                    className={styles.secondaryActionBtn}
                  >
                    Cancelar
                  </button>
                </div>

                <div className={styles.shelfEditRow}>
                  {QUICK_TITLE_SUGGESTIONS.map((sugg) => (
                    <button
                      key={sugg}
                      type="button"
                      onClick={() => {
                        setDraftTitle(sugg);
                        setDraftAsTitle(true);
                      }}
                      className={styles.shelfSuggestionChip}
                    >
                      {sugg}
                    </button>
                  ))}
                </div>

                <div className={styles.shelfEditRow}>
                  <button
                    type="button"
                    aria-pressed={draftAsTitle}
                    onClick={() => setDraftAsTitle((v) => !v)}
                    className={`${styles.colorPresetBtn} ${
                      draftAsTitle ? styles.colorPresetBtnActive : ""
                    }`}
                  >
                    {draftAsTitle
                      ? "Exibindo: título da coleção"
                      : "Exibindo: bolinhas de cores"}
                  </button>
                  <button
                    type="button"
                    aria-pressed={draftDots === undefined}
                    onClick={() => setDraftDots(undefined)}
                    className={`${styles.colorPresetBtn} ${
                      draftDots === undefined ? styles.colorPresetBtnActive : ""
                    }`}
                  >
                    Cores reais dos livros
                  </button>
                  {DOT_PALETTE_PRESETS.map((preset) => {
                    const active =
                      draftDots &&
                      JSON.stringify(draftDots) === JSON.stringify(preset.dots);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        aria-pressed={Boolean(active)}
                        onClick={() => {
                          setDraftDots([...preset.dots]);
                          setDraftAsTitle(false);
                        }}
                        className={`${styles.colorPresetBtn} ${
                          active ? styles.colorPresetBtnActive : ""
                        }`}
                      >
                        {preset.dots.map((hex, i) => (
                          <span
                            key={`${preset.label}-${i}`}
                            className={styles.colorDotItem}
                            style={{ backgroundColor: hex }}
                            aria-hidden="true"
                          />
                        ))}
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          />
        </section>

        {/* COLUNA DIREITA: Painel Sticky do Estúdio */}
        <aside
          aria-label="Controles de personalização da estante"
          className="rounded-2xl border border-[var(--rf-border-default)] bg-[var(--rf-surface-card)] p-4 shadow-sm xl:sticky xl:top-6"
        >
          {/* Navegação por abas do Estúdio */}
          <div
            role="tablist"
            aria-label="Seções do estúdio de personalização"
            className="mb-4 grid grid-cols-4 gap-1 rounded-xl border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] p-1"
          >
            {(
              [
                { id: "estilo", label: "Estilo", icon: Palette },
                { id: "objetos", label: "Objetos", icon: Lamp },
                { id: "livro", label: "Livro", icon: BookOpen },
                { id: "prateleiras", label: "Ordem", icon: Layers },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const hasBadge = tab.id === "livro" && Boolean(selectedBook);
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 font-sans text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                    isActive
                      ? "bg-[var(--rf-surface-card)] text-[var(--rf-text-heading)] shadow-xs ring-1 ring-[var(--rf-border-default)]"
                      : "text-[var(--rf-text-secondary)] hover:text-[var(--rf-text-primary)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {hasBadge ? (
                    <span
                      className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--rf-accent-primary)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* ABA 1: ESTILO, PRESETS, ARQUITETURA E ILUMINAÇÃO */}
          {activeTab === "estilo" ? (
            <div className="space-y-5">
              {/* Presets de 1 clique */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                    Presets de 1 clique
                  </h2>
                  {effectiveThemeConfig.presetId === "personalizada" ? (
                    <span className="rounded-full bg-[var(--rf-accent-primary-subtle)] px-2 py-0.5 font-sans text-[10px] font-semibold text-[var(--rf-text-accent)]">
                      Personalizada
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SHELF_PRESETS.map((preset) => {
                    const active = effectiveThemeConfig.presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleApplyPreset(preset.id)}
                        className={`flex flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                          active
                            ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)]"
                            : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] hover:border-[var(--rf-border-default)]"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <span className="font-serif text-sm font-semibold text-[var(--rf-text-heading)]">
                            {preset.label}
                          </span>
                          <span
                            className="inline-flex items-center -space-x-1"
                            aria-hidden="true"
                          >
                            {preset.swatches.map((hex, i) => (
                              <span
                                key={`${preset.id}-sw-${i}`}
                                className="h-3.5 w-3.5 rounded-full border border-black/20"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </span>
                        </div>
                        <span className="line-clamp-2 font-sans text-[11px] leading-snug text-[var(--rf-text-secondary)]">
                          {preset.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Materiais (5) */}
              <div>
                <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                  Material da tábua
                </h2>
                <div
                  role="radiogroup"
                  aria-label="Material da tábua da estante"
                  className="grid grid-cols-3 gap-1.5"
                >
                  {SHELF_MATERIAL_V2_OPTIONS.map((opt) => {
                    const active = effectiveThemeConfig.material === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={opt.description}
                        onClick={() =>
                          handlePatchTheme(
                            { material: opt.id },
                            `Material alterado para ${opt.label}.`
                          )
                        }
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 font-sans text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                          active
                            ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                            : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-default)]"
                        }`}
                      >
                        <span
                          className="inline-flex h-4 w-4 shrink-0 overflow-hidden rounded-full border border-black/20"
                          aria-hidden="true"
                        >
                          <span
                            className="h-full w-1/2"
                            style={{ backgroundColor: opt.swatchPrimary }}
                          />
                          <span
                            className="h-full w-1/2"
                            style={{ backgroundColor: opt.swatchAccent }}
                          />
                        </span>
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Suportes (3) */}
              <div>
                <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                  Suportes arquitetônicos
                </h2>
                <div
                  role="radiogroup"
                  aria-label="Estilo de suporte das prateleiras"
                  className="grid grid-cols-3 gap-1.5"
                >
                  {SHELF_BRACKET_OPTIONS.map((opt) => {
                    const active = effectiveThemeConfig.bracketStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={opt.description}
                        onClick={() =>
                          handlePatchTheme(
                            { bracketStyle: opt.id },
                            `Suporte: ${opt.label}.`
                          )
                        }
                        className={`rounded-xl border px-2.5 py-2 text-center font-sans text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                          active
                            ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                            : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-default)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fundo de Nicho (5) */}
              <div>
                <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                  Fundo do nicho
                </h2>
                <div
                  role="radiogroup"
                  aria-label="Fundo do nicho da estante"
                  className="grid grid-cols-2 gap-1.5"
                >
                  {SHELF_BACKDROP_OPTIONS.map((opt) => {
                    const active =
                      effectiveThemeConfig.nicheBackdrop === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() =>
                          handlePatchTheme(
                            { nicheBackdrop: opt.id },
                            `Fundo do nicho: ${opt.label}.`
                          )
                        }
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 font-sans text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                          active
                            ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                            : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-default)]"
                        }`}
                      >
                        <span
                          className="h-4 w-4 shrink-0 rounded-full border border-black/25"
                          style={{ backgroundColor: opt.swatch }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Iluminação Arquitetônica */}
              <div>
                <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                  Iluminação cênica
                </h2>
                <div className="space-y-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={effectiveThemeConfig.ledWarm3000K}
                    onClick={() =>
                      handlePatchTheme(
                        { ledWarm3000K: !effectiveThemeConfig.ledWarm3000K },
                        effectiveThemeConfig.ledWarm3000K
                          ? "LED quente 3000K desligado."
                          : "LED quente 3000K ligado sob as prateleiras."
                      )
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                      effectiveThemeConfig.ledWarm3000K
                        ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)]"
                        : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)]"
                    }`}
                  >
                    <div>
                      <p className="font-sans text-xs font-semibold text-[var(--rf-text-heading)]">
                        Fita LED Quente 3000K
                      </p>
                      <p className="font-sans text-[11px] text-[var(--rf-text-secondary)]">
                        Luz âmbar indireta embutida sob cada tábua
                      </p>
                    </div>
                    <span
                      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                        effectiveThemeConfig.ledWarm3000K
                          ? "bg-[var(--rf-accent-primary)] justify-end"
                          : "bg-[var(--rf-border-default)] justify-start"
                      }`}
                      aria-hidden="true"
                    >
                      <span className="h-4 w-4 rounded-full bg-[var(--rf-surface-card)] shadow-xs" />
                    </span>
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={effectiveThemeConfig.topSpotlights}
                    onClick={() =>
                      handlePatchTheme(
                        { topSpotlights: !effectiveThemeConfig.topSpotlights },
                        effectiveThemeConfig.topSpotlights
                          ? "Spots superiores desligados."
                          : "Spots superiores ativados no topo da estante."
                      )
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                      effectiveThemeConfig.topSpotlights
                        ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)]"
                        : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)]"
                    }`}
                  >
                    <div>
                      <p className="font-sans text-xs font-semibold text-[var(--rf-text-heading)]">
                        Spots Superiores
                      </p>
                      <p className="font-sans text-[11px] text-[var(--rf-text-secondary)]">
                        Dois fachos quentes suaves descendo da cornija
                      </p>
                    </div>
                    <span
                      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                        effectiveThemeConfig.topSpotlights
                          ? "bg-[var(--rf-accent-primary)] justify-end"
                          : "bg-[var(--rf-border-default)] justify-start"
                      }`}
                      aria-hidden="true"
                    >
                      <span className="h-4 w-4 rounded-full bg-[var(--rf-surface-card)] shadow-xs" />
                    </span>
                  </button>
                </div>
              </div>

              {/* Densidade (3) */}
              <div>
                <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                  Densidade dos livros
                </h2>
                <div
                  role="radiogroup"
                  aria-label="Densidade dos livros na estante"
                  className="grid grid-cols-3 gap-1.5"
                >
                  {SHELF_DENSITY_OPTIONS.map((opt) => {
                    const active = effectiveThemeConfig.density === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={opt.description}
                        onClick={() =>
                          handlePatchTheme(
                            { density: opt.id },
                            `Densidade: ${opt.label}.`
                          )
                        }
                        className={`rounded-xl border px-2.5 py-2 text-center font-sans text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                          active
                            ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                            : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-default)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Organização (3) */}
              <div>
                <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                  Modo de organização
                </h2>
                <div
                  role="radiogroup"
                  aria-label="Modo de organização das prateleiras"
                  className="grid grid-cols-3 gap-1.5"
                >
                  {ORG_MODE_V2_OPTIONS.map((opt) => {
                    const active =
                      effectiveThemeConfig.organizationMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={opt.description}
                        onClick={() => handleSelectOrganizationMode(opt.id)}
                        className={`rounded-xl border px-2.5 py-2 text-center font-sans text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                          active
                            ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                            : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-default)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* ABA 2: OBJETOS DECORATIVOS E ESPAÇADORES */}
          {activeTab === "objetos" ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="decor-target-shelf"
                  className="mb-1.5 block font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]"
                >
                  Prateleira alvo
                </label>
                <select
                  id="decor-target-shelf"
                  value={resolvedDecorShelfKey}
                  onChange={(e) => setTargetDecorShelfKey(e.target.value)}
                  className="w-full rounded-xl border border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] px-3 py-2 font-sans text-sm text-[var(--rf-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                >
                  {shelves.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.title} ({s.bookIds.length} livros)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="mb-1.5 block font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                  Posição na prateleira
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: "start", label: "Início" },
                      { id: "middle", label: "Meio" },
                      { id: "end", label: "Final" },
                    ] as const
                  ).map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      aria-pressed={decorInsertSpot === spot.id}
                      onClick={() => setDecorInsertSpot(spot.id)}
                      className={`rounded-lg border px-2 py-1.5 font-sans text-xs font-medium transition ${
                        decorInsertSpot === spot.id
                          ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                          : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-secondary)]"
                      }`}
                    >
                      {spot.label}
                    </button>
                  ))}
                </div>
                {selected && selected.shelfKey === resolvedDecorShelfKey ? (
                  <button
                    type="button"
                    aria-pressed={decorInsertSpot === "after-selected"}
                    onClick={() => setDecorInsertSpot("after-selected")}
                    className={`mt-1.5 w-full rounded-lg border px-2.5 py-1.5 font-sans text-xs font-medium transition ${
                      decorInsertSpot === "after-selected"
                        ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                        : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-secondary)]"
                    }`}
                  >
                    Logo após “{selectedBook?.title ?? "livro selecionado"}”
                  </button>
                ) : null}
              </div>

              <div>
                <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                  Adicionar objeto ou espaçador
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {SHELF_DECOR_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddDecor(item.id)}
                      className="flex flex-col items-start gap-0.5 rounded-xl border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] p-2.5 text-left transition hover:border-[var(--rf-accent-primary)] hover:bg-[var(--rf-accent-primary-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                    >
                      <span className="flex w-full items-center justify-between font-sans text-xs font-semibold text-[var(--rf-text-heading)]">
                        <span>{item.label}</span>
                        <Plus
                          className="h-3.5 w-3.5 text-[var(--rf-accent-primary)]"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="font-sans text-[11px] leading-snug text-[var(--rf-text-secondary)]">
                        {item.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de objetos já inseridos na prateleira alvo */}
              <div className="border-t border-[var(--rf-border-subtle)] pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                    Nesta prateleira ({activeDecorList.length})
                  </span>
                  {activeDecorList.length > 0 && resolvedDecorShelfKey ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleClearShelfDecor(resolvedDecorShelfKey)
                      }
                      className="font-sans text-[11px] font-semibold text-[var(--rf-status-error)] hover:underline"
                    >
                      Limpar tudo
                    </button>
                  ) : null}
                </div>

                {activeDecorList.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[var(--rf-border-default)] p-3 font-sans text-xs text-[var(--rf-text-secondary)]">
                    Nenhum objeto nesta prateleira ainda. Escolha um item acima
                    para compor o cenário.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {activeDecorList.map((decor) => {
                      const opt = SHELF_DECOR_OPTIONS.find(
                        (o) => o.id === decor.decorType
                      );
                      return (
                        <li
                          key={decor.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] px-3 py-2 font-sans text-xs"
                        >
                          <span className="font-medium text-[var(--rf-text-primary)]">
                            {opt?.label ?? decor.decorType}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveDecor(resolvedDecorShelfKey, decor.id)
                            }
                            aria-label={`Remover ${opt?.label ?? decor.decorType}`}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[var(--rf-status-error)] hover:bg-[var(--rf-status-error-bg)]"
                          >
                            <Trash2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            <span>Remover</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {/* ABA 3: LIVRO SELECIONADO */}
          {activeTab === "livro" ? (
            selected && selectedBook ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] p-3">
                  <div className="shrink-0">
                    <BookCover
                      size="xs"
                      title={selectedBook.title}
                      author={selectedBook.author}
                      coverUrl={selectedBook.coverUrl}
                      spineColor={selectedBook.spineBg}
                      spineAccent={selectedBook.spineAccentHex}
                      seed={selectedBook.resolvedSeed}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-sm font-semibold text-[var(--rf-text-heading)]">
                      {selectedBook.title}
                    </p>
                    {selectedBook.author ? (
                      <p className="truncate font-sans text-xs text-[var(--rf-text-secondary)]">
                        {selectedBook.author}
                      </p>
                    ) : null}
                    <p className="mt-1 font-sans text-[11px] text-[var(--rf-text-tertiary)]">
                      Prateleira:{" "}
                      {shelves.find((s) => s.key === selected.shelfKey)
                        ?.title ?? selected.shelfKey}
                    </p>
                  </div>
                </div>

                {/* Modo de Exibição (Lombada / Capa de Frente / Inclinado) */}
                <div>
                  <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                    Modo de exibição na estante
                  </h2>
                  <div
                    role="radiogroup"
                    aria-label={`Modo de exibição de ${selectedBook.title}`}
                    className="grid grid-cols-3 gap-1.5"
                  >
                    {BOOK_DISPLAY_MODE_OPTIONS.map((opt) => {
                      const active = selectedBookMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          title={opt.description}
                          onClick={() =>
                            handleSetBookDisplayMode(selected.bookId, opt.id)
                          }
                          className={`rounded-xl border px-2 py-2 text-center font-sans text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                            active
                              ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                              : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedBookMode === "inclinado" ? (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        aria-pressed={selectedBookTilt === "left"}
                        onClick={() =>
                          handleSetBookTiltDirection(selected.bookId, "left")
                        }
                        className={`rounded-lg border px-2.5 py-1.5 font-sans text-xs font-medium ${
                          selectedBookTilt === "left"
                            ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                            : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-secondary)]"
                        }`}
                      >
                        ↖ Inclinar à esquerda
                      </button>
                      <button
                        type="button"
                        aria-pressed={selectedBookTilt === "right"}
                        onClick={() =>
                          handleSetBookTiltDirection(selected.bookId, "right")
                        }
                        className={`rounded-lg border px-2.5 py-1.5 font-sans text-xs font-medium ${
                          selectedBookTilt === "right"
                            ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)] font-semibold"
                            : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-secondary)]"
                        }`}
                      >
                        ↗ Inclinar à direita
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Ordem e Prateleira */}
                <div>
                  <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                    Posição e prateleira
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNudgeSelected(-1)}
                      aria-label={`Mover ${selectedBook.title} para a esquerda`}
                      className={rfButtonClassName({
                        variant: "secondary",
                        secondaryStyle: "outline",
                        size: "sm",
                      })}
                    >
                      ← Esquerda
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNudgeSelected(1)}
                      aria-label={`Mover ${selectedBook.title} para a direita`}
                      className={rfButtonClassName({
                        variant: "secondary",
                        secondaryStyle: "outline",
                        size: "sm",
                      })}
                    >
                      Direita →
                    </button>
                  </div>

                  {shelves.length >= 2 ? (
                    <label className="mt-2.5 flex items-center gap-2">
                      <ArrowLeftRight
                        className="h-4 w-4 shrink-0 text-[var(--rf-text-secondary)]"
                        aria-hidden="true"
                      />
                      <span className="sr-only">
                        Mover para outra prateleira
                      </span>
                      <select
                        aria-label="Mover para outra prateleira"
                        value={selected.shelfKey}
                        onChange={(e) => {
                          const dest = e.target.value;
                          if (dest && dest !== selected.shelfKey) {
                            moveBook({
                              bookId: selected.bookId,
                              fromShelfKey: selected.shelfKey,
                              toShelfKey: dest,
                            });
                            setSelected({
                              shelfKey: dest,
                              bookId: selected.bookId,
                            });
                            setTargetDecorShelfKey(dest);
                          }
                        }}
                        className="flex-1 rounded-xl border border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] px-3 py-2 font-sans text-xs text-[var(--rf-text-primary)]"
                      >
                        {shelves.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>

                {/* Cor manual da lombada */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                      Cor da lombada
                    </h2>
                    {effectiveColorOverrides[selected.bookId] ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleChangeSelectedColor(selected.bookId, null)
                        }
                        className="font-sans text-[11px] font-semibold text-[var(--rf-accent-primary)] hover:underline"
                      >
                        Restaurar cor da capa
                      </button>
                    ) : null}
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label={`Cor da lombada de ${selectedBook.title}`}
                  >
                    {SPINE_COLOR_SWATCHES.map((sw) => {
                      const isCurrent =
                        selectedBook.spineBg.toLowerCase() ===
                        sw.hex.toLowerCase();
                      return (
                        <button
                          key={sw.hex}
                          type="button"
                          title={sw.label}
                          aria-label={`Trocar cor da lombada para ${sw.label}`}
                          aria-pressed={isCurrent}
                          onClick={() =>
                            handleChangeSelectedColor(selected.bookId, sw.hex)
                          }
                          className={`h-6 w-6 rounded-full border transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                            isCurrent
                              ? "scale-110 border-[var(--rf-text-heading)] ring-2 ring-[var(--rf-accent-primary)]"
                              : "border-black/25"
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      );
                    })}
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] px-2.5 py-1 font-sans text-xs font-medium text-[var(--rf-text-primary)]">
                      <input
                        type="color"
                        aria-label={`Cor personalizada da lombada de ${selectedBook.title}`}
                        value={selectedBook.spineBg}
                        onChange={(e) =>
                          handleChangeSelectedColor(
                            selected.bookId,
                            e.target.value
                          )
                        }
                        className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span>Outra cor</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] p-5 text-center">
                <BookOpen
                  className="mx-auto mb-2 h-6 w-6 text-[var(--rf-text-tertiary)]"
                  aria-hidden="true"
                />
                <p className="font-serif text-sm font-semibold text-[var(--rf-text-heading)]">
                  Nenhum livro selecionado
                </p>
                <p className="mt-1 font-sans text-xs leading-relaxed text-[var(--rf-text-secondary)]">
                  Clique em qualquer volume na estante ao lado para exibi-lo de
                  capa para frente, incliná-lo ou personalizar a cor da lombada.
                </p>
              </div>
            )
          ) : null}

          {/* ABA 4: PRATELEIRAS & ORDEM */}
          {activeTab === "prateleiras" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--rf-text-secondary)]">
                  Suas prateleiras ({shelves.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-[var(--rf-accent-primary)] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Nova</span>
                </button>
              </div>

              <ul className="space-y-2">
                {shelves.map((shelf, idx) => {
                  const decorCount = (effectiveDecorByRow[shelf.key] ?? [])
                    .length;
                  return (
                    <li
                      key={shelf.key}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-serif text-sm font-semibold text-[var(--rf-text-heading)]">
                          {shelf.title}
                        </p>
                        <p className="font-sans text-[11px] text-[var(--rf-text-secondary)]">
                          {shelf.bookIds.length}{" "}
                          {shelf.bookIds.length === 1 ? "livro" : "livros"}
                          {decorCount > 0
                            ? ` · ${decorCount} ${decorCount === 1 ? "objeto" : "objetos"}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Ordenar esta prateleira por cor"
                          aria-label={`Ordenar ${shelf.title} por cor`}
                          onClick={() => handleSortByColor(shelf.key)}
                          className="rounded-lg border border-[var(--rf-border-subtle)] p-1.5 text-[var(--rf-text-secondary)] hover:border-[var(--rf-border-default)] hover:text-[var(--rf-text-heading)]"
                        >
                          <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveShelf(shelf.key, -1)}
                          aria-label={`Subir prateleira ${shelf.title}`}
                          className="rounded-lg border border-[var(--rf-border-subtle)] px-2 py-1 font-sans text-xs font-semibold text-[var(--rf-text-secondary)] disabled:opacity-35"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === shelves.length - 1}
                          onClick={() => handleMoveShelf(shelf.key, 1)}
                          aria-label={`Descer prateleira ${shelf.title}`}
                          className="rounded-lg border border-[var(--rf-border-subtle)] px-2 py-1 font-sans text-xs font-semibold text-[var(--rf-text-secondary)] disabled:opacity-35"
                        >
                          ↓
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <ArrangeQuickAddModal
        open={Boolean(quickAddTarget)}
        targetShelfKey={quickAddTarget?.shelfKey ?? ""}
        targetShelfTitle={quickAddTarget?.shelfTitle ?? "Miscelânea"}
        onClose={() => setQuickAddTarget(null)}
        onBookAdded={handleBookAdded}
      />
    </div>
  );
}
