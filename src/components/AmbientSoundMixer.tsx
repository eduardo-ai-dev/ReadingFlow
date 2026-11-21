"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CloudLightning,
  CloudRain,
  Coffee,
  Flame,
  Library,
  Loader2,
  Moon,
  Play,
  Radio,
  Timer,
  Trees,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from "lucide-react";
import {
  AMBIENT_PRESETS,
  AMBIENT_SOUNDS,
  AMBIENT_SOUND_BY_ID,
  MAX_ACTIVE_AMBIENT_LAYERS,
  SLEEP_TIMER_OPTIONS_MINUTES,
  applyAmbientPreset,
  clampVolume,
  getEffectiveLayerVolume,
  normalizeAmbientPreferences,
  readPersistedAmbientPreferences,
  toggleAmbientLayer,
  writePersistedAmbientPreferences,
  type AmbientPreferences,
  type AmbientSoundIconKey,
  type AmbientSoundId,
  type SleepTimerMinutes,
} from "@/features/reading/ambient-catalog";
import { ambientAudioEngine } from "@/lib/audio/ambient-engine";
import { updateAmbientPreferencesAction } from "@/features/auth/actions";

function renderSoundIcon(icon: AmbientSoundIconKey) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (icon) {
    case "cloud-rain":
      return <CloudRain className={cls} aria-hidden="true" />;
    case "cloud-lightning":
      return <CloudLightning className={cls} aria-hidden="true" />;
    case "flame":
      return <Flame className={cls} aria-hidden="true" />;
    case "library":
      return <Library className={cls} aria-hidden="true" />;
    case "coffee":
      return <Coffee className={cls} aria-hidden="true" />;
    case "trees":
      return <Trees className={cls} aria-hidden="true" />;
    case "waves":
    case "waves-pink":
    case "waves-brown":
      return <Waves className={cls} aria-hidden="true" />;
    case "wind":
      return <Wind className={cls} aria-hidden="true" />;
    case "moon":
      return <Moon className={cls} aria-hidden="true" />;
    case "radio":
      return <Radio className={cls} aria-hidden="true" />;
  }
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function AmbientSoundMixer({
  initialPreferences,
  stopSignal = 0,
}: {
  initialPreferences?: AmbientPreferences | null;
  /** Incrementado quando a sessão de leitura é encerrada para silenciar o áudio (salvo continueAcrossPages). */
  stopSignal?: number;
}) {
  const [prefs, setPrefs] = useState<AmbientPreferences>(() => {
    const initial = normalizeAmbientPreferences(initialPreferences);
    if (initial.selectedIds.length > 0) return initial;
    return readPersistedAmbientPreferences() ?? initial;
  });
  // Camadas efetivamente em reprodução agora (sempre vazio ao abrir: ZERO autoplay!)
  const [playingIds, setPlayingIds] = useState<AmbientSoundId[]>(() =>
    ambientAudioEngine.getActiveIds()
  );
  const [loadingIds, setLoadingIds] = useState<Set<AmbientSoundId>>(
    () => new Set()
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState<SleepTimerMinutes>(0);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number>(0);

  const continueAcrossRef = useRef(prefs.continueAcrossPages);
  const saveTimerRef = useRef<number | null>(null);
  const prevStopSignalRef = useRef(stopSignal);

  useEffect(() => {
    continueAcrossRef.current = prefs.continueAcrossPages;
  }, [prefs.continueAcrossPages]);

  const persistPreferences = useCallback((next: AmbientPreferences) => {
    writePersistedAmbientPreferences(next);
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void updateAmbientPreferencesAction(next).catch(() => {});
    }, 450);
  }, []);

  // Sincroniza volume mestre inicial no motor sem iniciar reprodução (ZERO autoplay)
  useEffect(() => {
    ambientAudioEngine.setMasterVolume(prefs.masterVolume, 0);
  }, [prefs.masterVolume]);

  // Para o áudio ao sair do Canto de Foco, a menos que o usuário tenha ativado "Continuar em outras telas"
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      if (!continueAcrossRef.current) {
        ambientAudioEngine.stopAll(400);
      }
    };
  }, []);

  // Para o áudio quando o usuário encerra a sessão (a menos que continueAcrossPages esteja ativo)
  useEffect(() => {
    if (stopSignal !== prevStopSignalRef.current) {
      prevStopSignalRef.current = stopSignal;
      if (!continueAcrossRef.current && ambientAudioEngine.isPlayingAny()) {
        ambientAudioEngine.stopAll();
        const frameId = window.requestAnimationFrame(() => {
          setPlayingIds([]);
          setSleepMinutes(0);
          setSleepRemainingSec(0);
        });
        return () => window.cancelAnimationFrame(frameId);
      }
    }
  }, [stopSignal]);

  // Timer de desligamento suave (15/30/60 min) com fade ao chegar em zero
  useEffect(() => {
    if (sleepMinutes <= 0 || playingIds.length === 0) {
      return;
    }
    const endsAt = Date.now() + sleepMinutes * 60 * 1000;

    const interval = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSleepRemainingSec(left);
      if (left <= 0) {
        window.clearInterval(interval);
        ambientAudioEngine.stopAll();
        setPlayingIds([]);
        setSleepMinutes(0);
        setNotice("Timer encerrado com fade suave.");
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sleepMinutes, playingIds.length]);

  const startSound = useCallback(async (id: AmbientSoundId, volume: number) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const res = await ambientAudioEngine.startLayer(id, volume);
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    if (!res.ok) {
      setNotice(res.error);
      return false;
    }
    setPlayingIds(ambientAudioEngine.getActiveIds());
    return true;
  }, []);

  const handleToggleChip = async (id: AmbientSoundId) => {
    setNotice(null);
    const isCurrentlyPlaying = playingIds.includes(id);

    if (isCurrentlyPlaying) {
      ambientAudioEngine.stopLayer(id);
      setPlayingIds(ambientAudioEngine.getActiveIds());
      const next: AmbientPreferences = {
        ...prefs,
        selectedIds: prefs.selectedIds.filter((item) => item !== id),
      };
      setPrefs(next);
      persistPreferences(next);
      return;
    }

    // Se estava apenas "pronto" (restaurado sem autoplay), inicia imediatamente ao clicar
    if (prefs.selectedIds.includes(id)) {
      if (playingIds.length >= MAX_ACTIVE_AMBIENT_LAYERS) {
        setNotice(
          `Limite de ${MAX_ACTIVE_AMBIENT_LAYERS} sons simultâneos atingido. Desative uma camada antes de ativar outra.`
        );
        return;
      }
      ambientAudioEngine.setMasterVolume(prefs.masterVolume, 0);
      await startSound(id, getEffectiveLayerVolume(prefs, id));
      return;
    }

    const result = toggleAmbientLayer(prefs, id);
    if (!result.ok) {
      setNotice(
        `Limite de ${result.maxLayers} sons simultâneos atingido. Desative um som ativo para escolher outro.`
      );
      return;
    }

    setPrefs(result.next);
    persistPreferences(result.next);
    ambientAudioEngine.setMasterVolume(result.next.masterVolume, 0);
    const ok = await startSound(id, getEffectiveLayerVolume(result.next, id));
    if (!ok) {
      setPrefs(prefs);
      persistPreferences(prefs);
    }
  };

  const handlePlaySavedSelection = async () => {
    setNotice(null);
    if (prefs.selectedIds.length === 0) return;
    ambientAudioEngine.setMasterVolume(prefs.masterVolume, 0);
    await Promise.all(
      prefs.selectedIds
        .slice(0, MAX_ACTIVE_AMBIENT_LAYERS)
        .map((id) => startSound(id, getEffectiveLayerVolume(prefs, id)))
    );
  };

  const handleApplyPreset = async (presetId: string) => {
    setNotice(null);
    const next = applyAmbientPreset(prefs, presetId);
    if (!next) return;

    // Para camadas que não estão no preset com fade suave
    for (const activeId of ambientAudioEngine.getActiveIds()) {
      if (!next.selectedIds.includes(activeId)) {
        ambientAudioEngine.stopLayer(activeId);
      }
    }

    setPrefs(next);
    persistPreferences(next);
    ambientAudioEngine.setMasterVolume(next.masterVolume, 120);

    await Promise.all(
      next.selectedIds.map((id) =>
        startSound(id, getEffectiveLayerVolume(next, id))
      )
    );
    setPlayingIds(ambientAudioEngine.getActiveIds());
  };

  const handleMuteAll = () => {
    setNotice(null);
    ambientAudioEngine.stopAll();
    setPlayingIds([]);
    setSleepMinutes(0);
    setSleepRemainingSec(0);
  };

  const handleLayerVolumeChange = (id: AmbientSoundId, rawVal: number) => {
    const vol = clampVolume(rawVal);
    ambientAudioEngine.setLayerVolume(id, vol);
    const next: AmbientPreferences = {
      ...prefs,
      volumes: {
        ...prefs.volumes,
        [id]: vol,
      },
    };
    setPrefs(next);
    persistPreferences(next);
  };

  const handleMasterVolumeChange = (rawVal: number) => {
    const vol = clampVolume(rawVal);
    ambientAudioEngine.setMasterVolume(vol);
    const next: AmbientPreferences = {
      ...prefs,
      masterVolume: vol,
    };
    setPrefs(next);
    persistPreferences(next);
  };

  const handleToggleContinueAcross = (checked: boolean) => {
    const next: AmbientPreferences = {
      ...prefs,
      continueAcrossPages: checked,
    };
    setPrefs(next);
    persistPreferences(next);
  };

  const hasSavedNotPlaying =
    prefs.selectedIds.length > 0 && playingIds.length === 0;
  const activeCount = playingIds.length;

  return (
    <div
      data-ambient-mixer="true"
      className="space-y-3.5"
      aria-label="Mixer de sons ambiente"
    >
      {/* Cabeçalho de status + botão Silenciar tudo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {activeCount > 0 ? (
            <Volume2
              className="h-4 w-4 text-[var(--rf-text-accent-secondary)]"
              aria-hidden="true"
            />
          ) : (
            <VolumeX
              className="h-4 w-4 text-[var(--rf-text-tertiary)]"
              aria-hidden="true"
            />
          )}
          <span className="font-sans text-xs font-semibold text-[var(--rf-text-heading)]">
            Sons ambiente
          </span>
          <span className="rounded-full border border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[var(--rf-text-secondary)]">
            {activeCount}/{MAX_ACTIVE_AMBIENT_LAYERS}
          </span>
        </div>

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={handleMuteAll}
            className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-[var(--rf-border-strong)] bg-[var(--rf-surface-canvas)] px-2.5 font-sans text-[11px] font-semibold text-[var(--rf-text-primary)] hover:border-[var(--rf-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            <VolumeX className="h-3 w-3" aria-hidden="true" />
            Silenciar tudo
          </button>
        ) : null}
      </div>

      {/* Seleção restaurada pronta sem autoplay */}
      {hasSavedNotPlaying ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-canvas)] px-3 py-2">
          <div className="min-w-0">
            <p className="font-sans text-[11px] font-semibold text-[var(--rf-text-heading)]">
              Combinação pronta ({prefs.selectedIds.length})
            </p>
            <p className="truncate font-sans text-[10.5px] text-[var(--rf-text-secondary)]">
              {prefs.selectedIds
                .map((id) => AMBIENT_SOUND_BY_ID[id].shortLabel)
                .join(" + ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handlePlaySavedSelection()}
            className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-full bg-[var(--rf-accent-primary)] px-3 font-sans text-[11px] font-bold text-[var(--rf-accent-on-primary)] hover:bg-[var(--rf-accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            Iniciar
          </button>
        </div>
      ) : null}

      {/* Presets curados */}
      <div className="space-y-1.5">
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rf-text-secondary)]">
          Presets rápidos
        </p>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Presets de som ambiente"
        >
          {AMBIENT_PRESETS.map((preset) => {
            const matches =
              playingIds.length === preset.layers.length &&
              preset.layers.every((l) => playingIds.includes(l.id));
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={matches}
                title={preset.description}
                onClick={() => void handleApplyPreset(preset.id)}
                className={`rounded-full border px-2.5 py-1 font-sans text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                  matches
                    ? "border-[var(--rf-accent-secondary)] bg-[var(--rf-accent-secondary)] text-[var(--rf-accent-on-secondary)]"
                    : "border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-accent)]"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chips de sons (12 sons: 9 licenciados + 3 ruídos) */}
      <div
        role="group"
        aria-label="Escolher até 3 sons ambiente"
        className="grid grid-cols-2 gap-1.5"
      >
        {AMBIENT_SOUNDS.map((sound) => {
          const isPlaying = playingIds.includes(sound.id);
          const isReady = !isPlaying && prefs.selectedIds.includes(sound.id);
          const isLoading = loadingIds.has(sound.id);
          return (
            <button
              key={sound.id}
              type="button"
              aria-pressed={isPlaying}
              title={sound.description}
              onClick={() => void handleToggleChip(sound.id)}
              className={`flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left font-sans text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                isPlaying
                  ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary-subtle)] font-semibold text-[var(--rf-text-heading)]"
                  : isReady
                    ? "border-dashed border-[var(--rf-border-accent)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)]"
                    : "border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-secondary)] hover:border-[var(--rf-border-accent)] hover:text-[var(--rf-text-primary)]"
              }`}
            >
              {isLoading ? (
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--rf-text-accent-secondary)]"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className={
                    isPlaying
                      ? "text-[var(--rf-text-accent-secondary)]"
                      : "text-[var(--rf-text-tertiary)]"
                  }
                >
                  {renderSoundIcon(sound.icon)}
                </span>
              )}
              <span className="truncate">{sound.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Aviso de limite de camadas ou erro */}
      {notice ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--rf-status-warning)]/40 bg-[var(--rf-status-warning-bg)] px-2.5 py-1.5 font-sans text-[11px] font-medium text-[var(--rf-status-warning)]"
        >
          {notice}
        </p>
      ) : null}

      {/* Sliders por camada ativa + Volume mestre */}
      {playingIds.length > 0 ? (
        <div className="space-y-2.5 rounded-xl border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] p-3">
          {playingIds.map((id) => {
            const spec = AMBIENT_SOUND_BY_ID[id];
            const vol = getEffectiveLayerVolume(prefs, id);
            const sliderId = `ambient-vol-${id}`;
            return (
              <div key={id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={sliderId}
                    className="truncate font-sans text-[11px] font-semibold text-[var(--rf-text-primary)]"
                  >
                    {spec.label}
                  </label>
                  <span className="font-mono text-[10px] tabular-nums text-[var(--rf-text-secondary)]">
                    {Math.round(vol * 100)}%
                  </span>
                </div>
                <input
                  id={sliderId}
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(vol * 100)}
                  onChange={(e) =>
                    handleLayerVolumeChange(id, Number(e.target.value) / 100)
                  }
                  className="h-1.5 w-full cursor-pointer accent-[var(--rf-accent-secondary)]"
                />
              </div>
            );
          })}

          <div className="border-t border-[var(--rf-divider)] pt-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ambient-master-vol"
                className="font-sans text-[11px] font-bold text-[var(--rf-text-heading)]"
              >
                Volume geral
              </label>
              <span className="font-mono text-[10px] tabular-nums text-[var(--rf-text-secondary)]">
                {Math.round(prefs.masterVolume * 100)}%
              </span>
            </div>
            <input
              id="ambient-master-vol"
              type="range"
              min={0}
              max={100}
              value={Math.round(prefs.masterVolume * 100)}
              onChange={(e) =>
                handleMasterVolumeChange(Number(e.target.value) / 100)
              }
              className="mt-1 h-1.5 w-full cursor-pointer accent-[var(--rf-accent-primary)]"
            />
          </div>

          {/* Timer de desligamento (15 / 30 / 60 min) */}
          <div className="border-t border-[var(--rf-divider)] pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 font-sans text-[10.5px] font-semibold text-[var(--rf-text-secondary)]">
                <Timer className="h-3 w-3" aria-hidden="true" />
                Desligar após
              </span>
              {sleepMinutes > 0 && sleepRemainingSec > 0 ? (
                <span className="font-mono text-[10px] font-semibold tabular-nums text-[var(--rf-text-accent-secondary)]">
                  {formatCountdown(sleepRemainingSec)}
                </span>
              ) : null}
            </div>
            <div
              role="group"
              aria-label="Timer para desligar som ambiente"
              className="mt-1.5 grid grid-cols-4 gap-1"
            >
              {SLEEP_TIMER_OPTIONS_MINUTES.map((mins) => {
                const active = sleepMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSleepMinutes(mins);
                      setSleepRemainingSec(mins * 60);
                    }}
                    className={`rounded-md border px-1.5 py-1 font-sans text-[10.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                      active
                        ? "border-[var(--rf-accent-secondary)] bg-[var(--rf-accent-secondary)] text-[var(--rf-accent-on-secondary)]"
                        : "border-[var(--rf-border-default)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text-secondary)] hover:border-[var(--rf-border-accent)]"
                    }`}
                  >
                    {mins === 0 ? "Off" : `${mins}m`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Opção desligada por padrão: continuar em outras telas */}
      <label className="flex cursor-pointer items-center gap-2 font-sans text-[11px] text-[var(--rf-text-secondary)]">
        <input
          type="checkbox"
          checked={prefs.continueAcrossPages}
          onChange={(e) => handleToggleContinueAcross(e.target.checked)}
          className="h-3.5 w-3.5 shrink-0 accent-[var(--rf-accent-secondary)]"
        />
        <span>Continuar som em outras telas</span>
      </label>
    </div>
  );
}
