export type AmbientSoundId =
  | "chuva-suave"
  | "tempestade"
  | "lareira"
  | "biblioteca"
  | "cafeteria"
  | "floresta"
  | "ondas-mar"
  | "vento"
  | "noite-grilos"
  | "ruido-branco"
  | "ruido-rosa"
  | "ruido-marrom";

export type AmbientSoundKind = "file" | "noise";

export type AmbientSoundIconKey =
  | "cloud-rain"
  | "cloud-lightning"
  | "flame"
  | "library"
  | "coffee"
  | "trees"
  | "waves"
  | "wind"
  | "moon"
  | "radio"
  | "waves-pink"
  | "waves-brown";

export interface AmbientSoundSpec {
  id: AmbientSoundId;
  label: string;
  shortLabel: string;
  description: string;
  kind: AmbientSoundKind;
  icon: AmbientSoundIconKey;
  /** Caminho público em `public/audio/ambient/` para sons de arquivo. */
  src?: string;
  defaultVolume: number;
}

export interface AmbientPreset {
  id: string;
  label: string;
  description: string;
  layers: ReadonlyArray<{ id: AmbientSoundId; volume: number }>;
}

export interface AmbientPreferences {
  /** Camadas selecionadas pelo usuário (máximo 3). Restauradas como "prontas", nunca com autoplay. */
  selectedIds: AmbientSoundId[];
  /** Volume individual (0..1) por som. */
  volumes: Partial<Record<AmbientSoundId, number>>;
  /** Volume mestre (0..1). */
  masterVolume: number;
  /** Continuar tocando ao sair do Canto de Foco (desligado por padrão). */
  continueAcrossPages: boolean;
}

export const MAX_ACTIVE_AMBIENT_LAYERS = 3;
export const AMBIENT_FADE_MS = 800;
export const AMBIENT_STORAGE_KEY = "rf_focus_ambient_v1";
export const SLEEP_TIMER_OPTIONS_MINUTES = [0, 15, 30, 60] as const;
export type SleepTimerMinutes = (typeof SLEEP_TIMER_OPTIONS_MINUTES)[number];

export const AMBIENT_SOUNDS: readonly AmbientSoundSpec[] = [
  {
    id: "chuva-suave",
    label: "Chuva suave",
    shortLabel: "Chuva",
    description: "Gotas leves e constantes na janela.",
    kind: "file",
    icon: "cloud-rain",
    src: "/audio/ambient/chuva-suave.m4a",
    defaultVolume: 0.7,
  },
  {
    id: "tempestade",
    label: "Tempestade",
    shortLabel: "Tempestade",
    description: "Chuva encorpada com trovões distantes.",
    kind: "file",
    icon: "cloud-lightning",
    src: "/audio/ambient/tempestade.m4a",
    defaultVolume: 0.65,
  },
  {
    id: "lareira",
    label: "Lareira",
    shortLabel: "Lareira",
    description: "Brasas crepitando em ritmo calmo.",
    kind: "file",
    icon: "flame",
    src: "/audio/ambient/lareira.m4a",
    defaultVolume: 0.7,
  },
  {
    id: "biblioteca",
    label: "Biblioteca silenciosa",
    shortLabel: "Biblioteca",
    description: "Ambiência sutil de sala de leitura.",
    kind: "file",
    icon: "library",
    src: "/audio/ambient/biblioteca.m4a",
    defaultVolume: 0.65,
  },
  {
    id: "cafeteria",
    label: "Cafeteria",
    shortLabel: "Cafeteria",
    description: "Murmúrio distante e clima acolhedor de café.",
    kind: "file",
    icon: "coffee",
    src: "/audio/ambient/cafeteria.m4a",
    defaultVolume: 0.6,
  },
  {
    id: "floresta",
    label: "Floresta com pássaros",
    shortLabel: "Floresta",
    description: "Brisa entre árvores e canto suave de pássaros.",
    kind: "file",
    icon: "trees",
    src: "/audio/ambient/floresta.m4a",
    defaultVolume: 0.6,
  },
  {
    id: "ondas-mar",
    label: "Ondas do mar",
    shortLabel: "Mar",
    description: "Vai e vem cadenciado de ondas na areia.",
    kind: "file",
    icon: "waves",
    src: "/audio/ambient/ondas-mar.m4a",
    defaultVolume: 0.65,
  },
  {
    id: "vento",
    label: "Vento",
    shortLabel: "Vento",
    description: "Vento constante soprando ao longe.",
    kind: "file",
    icon: "wind",
    src: "/audio/ambient/vento.m4a",
    defaultVolume: 0.5,
  },
  {
    id: "noite-grilos",
    label: "Noite com grilos",
    shortLabel: "Grilos",
    description: "Noite tranquila de campo com grilos suaves.",
    kind: "file",
    icon: "moon",
    src: "/audio/ambient/noite-grilos.m4a",
    defaultVolume: 0.55,
  },
  {
    id: "ruido-branco",
    label: "Ruído branco",
    shortLabel: "Branco",
    description: "Espectro uniforme gerado localmente (mascaramento neutro).",
    kind: "noise",
    icon: "radio",
    defaultVolume: 0.3,
  },
  {
    id: "ruido-rosa",
    label: "Ruído rosa",
    shortLabel: "Rosa",
    description: "Equilibrado e suave aos ouvidos, ideal para concentração.",
    kind: "noise",
    icon: "waves-pink",
    defaultVolume: 0.4,
  },
  {
    id: "ruido-marrom",
    label: "Ruído marrom",
    shortLabel: "Marrom",
    description: "Grave, quente e profundo para abafar distrações.",
    kind: "noise",
    icon: "waves-brown",
    defaultVolume: 0.45,
  },
] as const;

export const AMBIENT_SOUND_BY_ID: Readonly<
  Record<AmbientSoundId, AmbientSoundSpec>
> = Object.fromEntries(AMBIENT_SOUNDS.map((s) => [s.id, s])) as Record<
  AmbientSoundId,
  AmbientSoundSpec
>;

export const AMBIENT_SOUND_IDS = new Set<string>(
  AMBIENT_SOUNDS.map((s) => s.id)
);

export const AMBIENT_PRESETS: readonly AmbientPreset[] = [
  {
    id: "chuva-na-janela",
    label: "Chuva na janela",
    description: "Chuva suave com brisa distante.",
    layers: [
      { id: "chuva-suave", volume: 0.72 },
      { id: "vento", volume: 0.28 },
    ],
  },
  {
    id: "lareira-e-chuva",
    label: "Lareira e chuva",
    description: "Fogo crepitando enquanto chove lá fora.",
    layers: [
      { id: "lareira", volume: 0.72 },
      { id: "chuva-suave", volume: 0.46 },
    ],
  },
  {
    id: "biblioteca-a-noite",
    label: "Biblioteca à noite",
    description: "Sala silenciosa, grilos ao longe e ruído marrom bem baixo.",
    layers: [
      { id: "biblioteca", volume: 0.65 },
      { id: "noite-grilos", volume: 0.34 },
      { id: "ruido-marrom", volume: 0.2 },
    ],
  },
  {
    id: "cafeteria",
    label: "Cafeteria",
    description: "Ambiente de café com chuva leve ao fundo.",
    layers: [
      { id: "cafeteria", volume: 0.7 },
      { id: "chuva-suave", volume: 0.24 },
    ],
  },
] as const;

export const DEFAULT_AMBIENT_PREFERENCES: AmbientPreferences = {
  selectedIds: [],
  volumes: {},
  masterVolume: 0.75,
  continueAcrossPages: false,
};

export function isAmbientSoundId(value: unknown): value is AmbientSoundId {
  return typeof value === "string" && AMBIENT_SOUND_IDS.has(value);
}

export function clampVolume(value: number, fallback = 0.65): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function normalizeAmbientPreferences(
  raw?: Partial<AmbientPreferences> | null
): AmbientPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_AMBIENT_PREFERENCES, selectedIds: [], volumes: {} };
  }

  const seen = new Set<AmbientSoundId>();
  const selectedIds: AmbientSoundId[] = [];
  if (Array.isArray(raw.selectedIds)) {
    for (const id of raw.selectedIds) {
      if (isAmbientSoundId(id) && !seen.has(id)) {
        seen.add(id);
        selectedIds.push(id);
        if (selectedIds.length >= MAX_ACTIVE_AMBIENT_LAYERS) break;
      }
    }
  }

  const volumes: Partial<Record<AmbientSoundId, number>> = {};
  if (raw.volumes && typeof raw.volumes === "object") {
    for (const [key, val] of Object.entries(raw.volumes)) {
      if (isAmbientSoundId(key) && typeof val === "number") {
        volumes[key] = clampVolume(val, AMBIENT_SOUND_BY_ID[key].defaultVolume);
      }
    }
  }

  return {
    selectedIds,
    volumes,
    masterVolume:
      typeof raw.masterVolume === "number"
        ? clampVolume(
            raw.masterVolume,
            DEFAULT_AMBIENT_PREFERENCES.masterVolume
          )
        : DEFAULT_AMBIENT_PREFERENCES.masterVolume,
    continueAcrossPages: Boolean(raw.continueAcrossPages),
  };
}

export function getEffectiveLayerVolume(
  prefs: AmbientPreferences,
  id: AmbientSoundId
): number {
  const saved = prefs.volumes[id];
  if (typeof saved === "number") return clampVolume(saved);
  return AMBIENT_SOUND_BY_ID[id].defaultVolume;
}

export function toggleAmbientLayer(
  prefs: AmbientPreferences,
  id: AmbientSoundId
):
  | { ok: true; next: AmbientPreferences; added: boolean }
  | { ok: false; reason: "max_layers"; maxLayers: number } {
  const exists = prefs.selectedIds.includes(id);
  if (exists) {
    return {
      ok: true,
      added: false,
      next: {
        ...prefs,
        selectedIds: prefs.selectedIds.filter((item) => item !== id),
      },
    };
  }

  if (prefs.selectedIds.length >= MAX_ACTIVE_AMBIENT_LAYERS) {
    return {
      ok: false,
      reason: "max_layers",
      maxLayers: MAX_ACTIVE_AMBIENT_LAYERS,
    };
  }

  const nextVolume = getEffectiveLayerVolume(prefs, id);
  return {
    ok: true,
    added: true,
    next: {
      ...prefs,
      selectedIds: [...prefs.selectedIds, id],
      volumes: {
        ...prefs.volumes,
        [id]: nextVolume,
      },
    },
  };
}

export function applyAmbientPreset(
  prefs: AmbientPreferences,
  presetId: string
): AmbientPreferences | null {
  const preset = AMBIENT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  const layers = preset.layers.slice(0, MAX_ACTIVE_AMBIENT_LAYERS);
  const nextVolumes: Partial<Record<AmbientSoundId, number>> = {
    ...prefs.volumes,
  };
  for (const layer of layers) {
    nextVolumes[layer.id] = clampVolume(layer.volume);
  }

  return {
    ...prefs,
    selectedIds: layers.map((l) => l.id),
    volumes: nextVolumes,
  };
}

export function getAmbientStorageKey(userId?: string | null): string {
  const clean = userId?.trim();
  return clean ? `${AMBIENT_STORAGE_KEY}:${clean}` : AMBIENT_STORAGE_KEY;
}

export function readPersistedAmbientPreferences(
  userId?: string | null
): AmbientPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getAmbientStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AmbientPreferences>;
    return normalizeAmbientPreferences(parsed);
  } catch {
    return null;
  }
}

export function writePersistedAmbientPreferences(
  prefs: AmbientPreferences,
  userId?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getAmbientStorageKey(userId),
      JSON.stringify(normalizeAmbientPreferences(prefs))
    );
  } catch {
    // Quota ou modo privado: ignora silenciosamente
  }
}
